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


// ================================
// TEMPORARY ANIMATION TEST
// Remove this after testing
// ================================

setTimeout(() => {
    showBurnAnimation();
}, 3000);