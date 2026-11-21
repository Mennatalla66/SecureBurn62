// SecureBurn destruction animation
export function showBurnAnimation() {
    const overlay = document.getElementById('burnOverlay');
    const text = document.getElementById('burnText');

    if (!overlay || !text) {
        console.error('Burn elements not found');
        return;
    }

    text.textContent = 'MESSAGE DESTROYED';

    overlay.classList.add('active');

    // Restart animation
    text.style.animation = 'none';
    void text.offsetWidth;
    text.style.animation = '';

    console.log('SecureBurn animation started');
}
