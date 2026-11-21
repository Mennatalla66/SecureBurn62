// ====================================
            // Display decrypted text
            // ====================================

            $('decryptedMessage').textContent =
                payload.text || '';


            // ====================================
            // Display attached file (if available)
            // ====================================

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
                    payload.file.name ||
                    'secureburn-download';

                $('fileName').textContent =
                    File ready: ${payload.file.name} (${(bytes.length / 1024).toFixed(1)} KB);

                $('fileDownload').classList.remove('hidden');
            }


            // ====================================
            // Show message
            // ====================================

            $('messageBox').classList.remove('hidden');

            $('status').textContent =
                'Unlocked. Content was decrypted on this device.';

            console.log('SecureBurn: Message decrypted successfully.');


        } catch (e) {

            // ====================================
            // Error handling
            // ====================================

            $('status').textContent =
                e.message ||
                'Unable to unlock. Check your credentials and try again.';

            console.error('SecureBurn error:', e);


        } finally {

            // Re-enable button
            unlockBtn.disabled = false;

        }

    });

}


// ============================================
// Animation test function
// ============================================
// IMPORTANT:
// Animation will NOT run automatically.
// Call showBurnAnimation() manually when needed.
// ============================================