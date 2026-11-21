// ========================================
// SecureBurn - Message Decryption & Destruction
// ========================================

function fromB64u(value) {
    const b = value.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b + '='.repeat((4 - b.length % 4) % 4));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
}

const $ = id => document.getElementById(id);


// ========================================
// MESSAGE DESTRUCTION ANIMATION
// ========================================

function showBurnAnimation(message = 'MESSAGE DESTROYED') {
    const overlay = $('burnOverlay');
    const text = $('burnText');

    if (!overlay || !text) {
        console.error('Burn elements not found.');
        return;
    }

    text.textContent = message;

    // Show the destruction overlay
    overlay.classList.add('active');

    // Restart animation
    text.style.animation = 'none';
    void text.offsetWidth;
    text.style.animation = '';

    console.log('SecureBurn destruction animation started');
}


// ========================================
// DETECT EXPIRED OR DESTROYED MESSAGES
// ========================================

function isExpiredMessage(errorMessage) {
    const error = String(errorMessage || '').toLowerCase();

    return (
        error.includes('expired') ||
        error.includes('destroyed') ||
        error.includes('already opened') ||
        error.includes('already accessed') ||
        error.includes('consumed')
    );
}


// ========================================
// UNLOCK & DECRYPT MESSAGE
// ========================================

$('unlockBtn').addEventListener('click', async () => {

    const mid = document.body.dataset.messageId;
    const token = $('accessTokenInput').value.trim();
    const password = $('passwordInput').value;
    const keyText = $('secretKeyInput').value.trim();

    $('messageBox').classList.add('hidden');
    $('fileDownload').classList.add('hidden');

    // Check required credentials
    if (!token || !keyText) {
        $('status').textContent =
            'Access token and secret key are required.';
        return;
    }

    $('unlockBtn').disabled = true;

    $('status').textContent =
        'Verifying access and retrieving encrypted content…';

    try {

        // Request encrypted message from server
        const response = await fetch(
            /api/messages/${encodeURIComponent(mid)}/open,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, password }),
                cache: 'no-store'
            }
        );

        const data = await response.json();

        // Handle errors from server
        if (!response.ok) {

            const errorMessage =
                data.error || 'Access denied.';

            $('status').textContent = errorMessage;

            // Show animation if the message has expired
            if (isExpiredMessage(errorMessage)) {
                setTimeout(() => {
                    showBurnAnimation('MESSAGE DESTROYED');
                }, 500);
            }

            throw new Error(errorMessage);
        }

        // ========================================
        // DECRYPT MESSAGE IN THE BROWSER
        // ========================================

        $('status').textContent =
            'Decrypting locally in your browser…';

        const key = await crypto.subtle.importKey(
            'raw',
            fromB64u(keyText),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        const plain = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: fromB64u(data.iv)
            },
            key,
            fromB64u(data.ciphertext)
        );

        const payload = JSON.parse(
            new TextDecoder().decode(plain)
        );

        // Display decrypted message
        $('decryptedMessage').textContent =
            payload.text || '';
[21/11/2026 04:18 م] M: // ========================================
        // HANDLE FILE ATTACHMENT
        // ========================================

        if (payload.file) {

            const bytes = fromB64u(payload.file.data);

            const blob = new Blob(
                [bytes],
                {
                    type: payload.file.type ||
                        'application/octet-stream'
                }
            );

            const url = URL.createObjectURL(blob);

            $('downloadFile').href = url;

            $('downloadFile').download =
                payload.file.name || 'secureburn-download';

            $('fileName').textContent =
                File ready: ${payload.file.name}  +
                (${(bytes.length / 1024).toFixed(1)} KB);

            $('fileDownload').classList.remove('hidden');
        }

        // Display decrypted content
        $('messageBox').classList.remove('hidden');

        $('status').textContent =
            'Unlocked. Content was decrypted on this device.';

    } catch (e) {

        $('status').textContent =
            e.message ||
            'Unable to unlock. Check your credentials and try again.';

        console.error('SecureBurn error:', e);

    } finally {

        $('unlockBtn').disabled = false;

    }

});