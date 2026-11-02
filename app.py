import os, hmac, hashlib, secrets, sqlite3
from datetime import datetime, timedelta, timezone
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024  # encrypted JSON payload; client-side file limit is 8 MiB
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'secureburn.db')
SERVER_SECRET = os.environ.get('SECRET_KEY', '').encode()

if not SERVER_SECRET:
    # Local development only. Set a long random SECRET_KEY in production.
    SERVER_SECRET = b'LOCAL-ONLY-change-this-before-deployment'


def now(): return datetime.now(timezone.utc)
def db():
    c = sqlite3.connect(DB_PATH, timeout=15)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with db() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY, ciphertext TEXT NOT NULL, iv TEXT NOT NULL,
            expires_at TEXT NOT NULL, token_hash TEXT NOT NULL, payload_hmac TEXT NOT NULL,
            created_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
            one_time INTEGER NOT NULL DEFAULT 1, password_salt TEXT, password_hash TEXT,
            open_count INTEGER NOT NULL DEFAULT 0, first_opened_at TEXT
        )''')
        existing = {r[1] for r in c.execute('PRAGMA table_info(messages)')}
        additions = {
            'password_salt': 'TEXT', 'password_hash': 'TEXT',
            'open_count': 'INTEGER NOT NULL DEFAULT 0', 'first_opened_at': 'TEXT'
        }
        for name, typ in additions.items():
            if name not in existing: c.execute(f'ALTER TABLE messages ADD COLUMN {name} {typ}')

def sign(mid, ciphertext, iv, expires):
    raw = f'{mid}|{ciphertext}|{iv}|{expires}'.encode()
    return hmac.new(SERVER_SECRET, raw, hashlib.sha256).hexdigest()

def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return salt.hex(), digest.hex()

@app.after_request
def headers(resp):
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'DENY'
    resp.headers['Referrer-Policy'] = 'no-referrer'
    resp.headers['Cache-Control'] = 'no-store'
    resp.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    return resp

@app.get('/')
def home(): return render_template('index.html')
@app.get('/m/<mid>')
def view(mid): return render_template('view_message.html', message_id=mid)

@app.post('/api/messages')
def create():
    d = request.get_json(silent=True) or {}
    ciphertext, iv, token = d.get('ciphertext'), d.get('iv'), d.get('token')
    one_time = d.get('one_time', True)
    try: minutes = int(d.get('expires_minutes', 60))
    except (TypeError, ValueError): return jsonify(error='Invalid expiry period.'), 400
    password = d.get('password', '')
    if not all(isinstance(x, str) for x in (ciphertext, iv, token, password)):
        return jsonify(error='Invalid request data.'), 400
    if not ciphertext or len(ciphertext) > 11_000_000 or not iv or len(token) < 30:
        return jsonify(error='Missing or oversized encrypted data.'), 400
    if not isinstance(one_time, bool) or not 1 <= minutes <= 1440:
        return jsonify(error='Invalid access settings.'), 400
    if len(password) > 128: return jsonify(error='Password is too long.'), 400
    mid, created = secrets.token_urlsafe(12), now()
    expiry = (created + timedelta(minutes=minutes)).isoformat()
    salt_hex = password_hash = None
    if password:
        salt_hex, password_hash = hash_password(password)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    signature = sign(mid, ciphertext, iv, expiry)
    with db() as c:
        c.execute('''INSERT INTO messages
          (id,ciphertext,iv,expires_at,token_hash,payload_hmac,created_at,used,one_time,password_salt,password_hash)
          VALUES (?,?,?,?,?,?,?,0,?,?,?)''',
          (mid,ciphertext,iv,expiry,token_hash,signature,created.isoformat(),int(one_time),salt_hex,password_hash))
    return jsonify(message_id=mid, expires_at=expiry, one_time=one_time, password_required=bool(password)), 201

@app.post('/api/messages/<mid>/open')
def open_message(mid):
    d = request.get_json(silent=True) or {}
    token, password = d.get('token', ''), d.get('password', '')
    if not isinstance(token, str) or not isinstance(password, str): return jsonify(error='Invalid credentials.'), 400
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        row = c.execute('SELECT * FROM messages WHERE id=?', (mid,)).fetchone()
        if row is None: c.rollback(); return jsonify(error='Message not found.'), 404
        if row['one_time'] and row['used']: c.rollback(); return jsonify(error='This message has already been opened.'), 410
        if now() >= datetime.fromisoformat(row['expires_at']):
            c.execute('DELETE FROM messages WHERE id=?', (mid,)); c.commit()
            return jsonify(error='This message has expired.'), 410
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if not hmac.compare_digest(token_hash, row['token_hash']): c.rollback(); return jsonify(error='Invalid access token.'), 403
        if row['password_hash']:
            if not password: c.rollback(); return jsonify(error='PASSWORD_REQUIRED'), 401
            _, candidate = hash_password(password, bytes.fromhex(row['password_salt']))
            if not hmac.compare_digest(candidate, row['password_hash']): c.rollback(); return jsonify(error='Incorrect password.'), 403
        expected = sign(mid,row['ciphertext'],row['iv'],row['expires_at'])
        if not hmac.compare_digest(expected,row['payload_hmac']): c.rollback(); return jsonify(error='Integrity verification failed.'), 500
        opened = now().isoformat()
        c.execute('UPDATE messages SET used=CASE WHEN one_time=1 THEN 1 ELSE used END, open_count=open_count+1, first_opened_at=COALESCE(first_opened_at,?) WHERE id=?',(opened,mid))
        c.commit()
    return jsonify(ciphertext=row['ciphertext'],iv=row['iv'],expires_at=row['expires_at'],opened_at=opened)

@app.errorhandler(413)
def too_large(_): return jsonify(error='Upload too large. Maximum file size is 8 MiB.'), 413

init_db()
if __name__ == '__main__': app.run(debug=False, port=int(os.environ.get('PORT','5000')))
