document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const scanReceiptBtn = document.getElementById('scan-receipt-btn');
    const scannerOverlay = document.getElementById('scanner-overlay');
    const closeBtn = document.getElementById('close-scanner-btn');
    const cameraView = document.getElementById('camera-view');
    const cameraCanvas = document.getElementById('camera-canvas');
    const captureBtn = document.getElementById('capture-image-btn');
    const uploadBtn = document.getElementById('upload-image-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const previewContainer = document.getElementById('preview-container');
    const cameraContainer = document.getElementById('camera-container');
    const previewImage = document.getElementById('preview-image');
    const selectionBox = document.getElementById('selection-box');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const retryBtn = document.getElementById('retry-capture-btn');
    const detectedAmounts = document.getElementById('detected-amounts');
    const noAmountsMessage = document.getElementById('no-amounts-message');
    const expenseAmountInput = document.getElementById('expense-amount');

    // State variables
    let stream = null;
    let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    let currentImage = null;
    
    // Add iOS class to body if on iOS device
    if (isIOS) {
        document.body.classList.add('ios-device');
    }
    
    let imageScale = 1;
    let imageTranslateX = 0;
    let imageTranslateY = 0;
    let isDragging = false;
    let startX, startY;
    let lastX, lastY;
    let isSelecting = false;
    let selectionStartX, selectionStartY;
    let ocrInProgress = false;
    let ocrTimeout = null;

    // Initialize OCR library
    let Tesseract = null;

    // Open the scanner
    function openScanner() {
        scannerOverlay.classList.remove('hidden');
        
        // Check if Tesseract is available
        console.log('Checking Tesseract availability:', 
            window.Tesseract ? 'Available' : 'Not available'
        );

        if (isIOS) {
            // On iOS, we'll use the system camera
            captureBtn.textContent = 'Take Photo';
            // Hide the upload text on iOS, showing only the icon
            document.querySelector('.upload-text').style.display = 'none';
        } else {
            // On other platforms, we'll use the camera stream
            startCamera();
        }
    }

    // Close the scanner
    function closeScanner() {
        scannerOverlay.classList.add('hidden');
        stopCamera();
        resetScannerUI();
    }

    // Start the camera
    function startCamera() {
        if (isIOS) {
            // iOS devices will use the system camera when the capture button is clicked
            return;
        }

        // For non-iOS devices, we'll use the camera stream
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            })
            .then(mediaStream => {
                stream = mediaStream;
                cameraView.srcObject = mediaStream;
                cameraContainer.classList.remove('hidden');
                previewContainer.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error accessing camera:', error);
                alert('Unable to access camera. Please make sure you have granted camera permissions.');
            });
        } else {
            alert('Your browser does not support camera access.');
        }
    }

    // Stop the camera
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }

    // Reset the scanner UI
    function resetScannerUI() {
        // Show camera container and hide preview
        cameraContainer.classList.remove('hidden');
        previewContainer.classList.add('hidden');
        
        // Reset all state variables
        currentImage = null;
        imageScale = 1;
        imageTranslateX = 0;
        imageTranslateY = 0;
        isDragging = false;
        isSelecting = false;
        selectionBox.classList.add('hidden');
        detectedAmounts.innerHTML = '';
        noAmountsMessage.classList.add('hidden');
        previewImage.src = '';
        
        // Clear any pending OCR timeout
        if (ocrTimeout) {
            clearTimeout(ocrTimeout);
            ocrTimeout = null;
        }
        
        // Restart the camera if not on iOS
        if (!isIOS) {
            startCamera();
        }
    }

    // Capture image from camera
    function captureImage() {
        if (isIOS) {
            // For iOS, use the system camera
            imageUploadInput.setAttribute('capture', 'environment');
            imageUploadInput.click();
            return;
        }

        // For non-iOS devices, capture from the video stream
        const context = cameraCanvas.getContext('2d');
        cameraCanvas.width = cameraView.videoWidth;
        cameraCanvas.height = cameraView.videoHeight;
        context.drawImage(cameraView, 0, 0, cameraCanvas.width, cameraCanvas.height);
        
        // Convert to image
        const imageDataURL = cameraCanvas.toDataURL('image/png');
        processImage(imageDataURL);
    }

    // Process the captured or uploaded image
    function processImage(imageDataURL) {
        // Stop the camera stream
        stopCamera();
        
        // Show the preview container
        cameraContainer.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        
        // Set the preview image
        previewImage.onload = () => {
            currentImage = {
                width: previewImage.naturalWidth,
                height: previewImage.naturalHeight,
                src: imageDataURL
            };
            
            // Perform OCR after a short delay to allow the UI to update
            scheduleOCR();
        };
        previewImage.src = imageDataURL;
    }

    // Schedule OCR with a delay to prevent UI lag
    function scheduleOCR() {
        if (ocrTimeout) {
            clearTimeout(ocrTimeout);
        }
        
        ocrTimeout = setTimeout(() => {
            performOCR();
        }, 500);
    }

    // Perform OCR on the image
    function performOCR(useHighAccuracy = false) {
        if (ocrInProgress) return;
        ocrInProgress = true;
        
        detectedAmounts.innerHTML = '';
        noAmountsMessage.classList.add('hidden');
        
        // Show loading indicator
        const loadingEl = document.createElement('p');
        loadingEl.textContent = 'Processing image...';
        loadingEl.id = 'ocr-loading';
        detectedAmounts.appendChild(loadingEl);
        
        // Create a temporary canvas to process the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // If selection box is active, only process that area
        if (!selectionBox.classList.contains('hidden')) {
            const rect = selectionBox.getBoundingClientRect();
            const imgRect = previewImage.getBoundingClientRect();
            
            // Calculate the selection in the original image coordinates
            const scaleX = previewImage.naturalWidth / imgRect.width;
            const scaleY = previewImage.naturalHeight / imgRect.height;
            
            const selX = (rect.left - imgRect.left) * scaleX;
            const selY = (rect.top - imgRect.top) * scaleY;
            const selWidth = rect.width * scaleX;
            const selHeight = rect.height * scaleY;
            
            canvas.width = selWidth;
            canvas.height = selHeight;
            
            // Draw only the selected portion
            ctx.drawImage(
                previewImage, 
                selX, selY, selWidth, selHeight, 
                0, 0, selWidth, selHeight
            );
        } else {
            // Process the entire image
            canvas.width = previewImage.naturalWidth;
            canvas.height = previewImage.naturalHeight;
            ctx.drawImage(previewImage, 0, 0);
        }
        
        try {
            // Check if Tesseract is available
            if (window.Tesseract) {
                console.log('Using Tesseract for OCR');
                
                // Show a more detailed loading message
                loadingEl.textContent = 'Processing image (this may take a moment)...';
                
                // Configure Tesseract options based on accuracy level
                const tesseractOptions = {
                    lang: 'eng',
                    logger: m => {
                        console.log('Tesseract progress:', m);
                        if (m.status === 'recognizing text') {
                            loadingEl.textContent = `Processing: ${Math.round(m.progress * 100)}%`;
                        }
                    }
                };
                
                // Use higher quality settings for high accuracy mode
                if (useHighAccuracy) {
                    tesseractOptions.engineMode = 1; // Tesseract only (more accurate)
                    loadingEl.textContent = 'Processing with high accuracy (this may take longer)...';
                }
                
                window.Tesseract.recognize(
                    canvas,
                    'eng',
                    tesseractOptions
                )
                .then(result => {
                    console.log('Tesseract result:', result);
                    if (result && result.data && result.data.text) {
                        processOCRResult(result.data.text, useHighAccuracy, result.data.words || []);
                    } else if (result && result.text) {
                        processOCRResult(result.text, useHighAccuracy, result.words || []);
                    } else {
                        noAmountsMessage.classList.remove('hidden');
                    }
                })
                .catch(error => {
                    console.error('Tesseract processing error:', error);
                    noAmountsMessage.classList.remove('hidden');
                })
                .finally(() => {
                    document.getElementById('ocr-loading')?.remove();
                    ocrInProgress = false;
                });
            } else {
                throw new Error('Tesseract not available globally');
            }
        } catch (error) {
            console.error('Error using Tesseract:', error);
            noAmountsMessage.classList.remove('hidden');
            document.getElementById('ocr-loading')?.remove();
            ocrInProgress = false;
        }
    }

    // Process the OCR result to extract amounts
    function processOCRResult(text, useHighAccuracy, words = []) {
        console.log('OCR Result:', text);
        
        // Regular expression to match currency amounts with decimal points (more likely to be prices)
        // This will prioritize patterns like $34.02, 34.02, etc.
        const decimalAmountRegex = /(?:[$€£¥]?\s*)([0-9,]+\.[0-9]{2})/g;
        
        // Regular expression for any number (used as fallback)
        const anyNumberRegex = /(?:[$€£¥]?\s*)([0-9,]+(?:\.[0-9]+)?)/g;
        
        let match;
        let amounts = [];
        
        // First try to find amounts with decimal points (more likely to be prices)
        while ((match = decimalAmountRegex.exec(text)) !== null) {
            // Extract the amount and clean it up
            let amount = match[1].replace(/,/g, '');
            
            // Validate that it's a valid number
            if (!isNaN(parseFloat(amount))) {
                // For Tesseract, we can use confidence information if available
                let confidence = 0;
                if (words.length > 0) {
                    // Try to find the word that contains this amount
                    for (const word of words) {
                        if (word.text.includes(match[1]) || word.text.includes(amount)) {
                            confidence = word.confidence || 0;
                            break;
                        }
                    }
                }
                
                amounts.push({
                    value: amount,
                    confidence: confidence,
                    hasDecimal: true
                });
            }
        }
        
        // If no decimal amounts found, try any number as fallback
        if (amounts.length === 0) {
            while ((match = anyNumberRegex.exec(text)) !== null) {
                // Extract the amount and clean it up
                let amount = match[1].replace(/,/g, '');
                
                // Validate that it's a valid number
                if (!isNaN(parseFloat(amount))) {
                    // Skip single digits and very small numbers (likely not prices)
                    if (amount.length === 1 || (parseFloat(amount) < 1 && !amount.includes('.'))) {
                        continue;
                    }
                    
                    // For Tesseract, we can use confidence information if available
                    let confidence = 0;
                    if (words.length > 0) {
                        // Try to find the word that contains this amount
                        for (const word of words) {
                            if (word.text.includes(match[1]) || word.text.includes(amount)) {
                                confidence = word.confidence || 0;
                                break;
                            }
                        }
                    }
                    
                    amounts.push({
                        value: amount,
                        confidence: confidence,
                        hasDecimal: amount.includes('.')
                    });
                }
            }
        }
        
        // Sort by confidence and limit to top results
        if (amounts.length > 0) {
            // Sort by decimal first, then by confidence
            amounts.sort((a, b) => {
                if (a.hasDecimal && !b.hasDecimal) return -1;
                if (!a.hasDecimal && b.hasDecimal) return 1;
                return b.confidence - a.confidence;
            });
            
            // Don't filter by confidence if we have very few results
            if (amounts.length > 3) {
                // Filter out low confidence results (below 40%)
                amounts = amounts.filter(a => a.confidence >= 40);
            }
            
            // Limit to top 3 results
            if (amounts.length > 3) {
                amounts = amounts.slice(0, 3);
            }
        }
        
        // Display the detected amounts
        if (amounts.length > 0) {
            amounts.forEach(amount => {
                const amountBtn = document.createElement('button');
                amountBtn.classList.add('amount-btn');
                amountBtn.textContent = amount.value;
                if (amount.confidence > 0) {
                    amountBtn.title = `Confidence: ${Math.round(amount.confidence)}%`;
                }
                amountBtn.addEventListener('click', () => {
                    selectAmount(amount.value);
                });
                detectedAmounts.appendChild(amountBtn);
            });
        } else {
            noAmountsMessage.classList.remove('hidden');
        }
    }

    // Select an amount and close the scanner
    function selectAmount(amount) {
        expenseAmountInput.value = amount;
        closeScanner();
    }

    // Handle image zooming
    function zoomImage(zoomIn) {
        if (zoomIn) {
            imageScale += 0.1;
        } else {
            imageScale = Math.max(0.5, imageScale - 0.1);
        }
        
        updateImageTransform();
        
        // Schedule OCR after zooming
        if (!isSelecting && !isDragging) {
            scheduleOCR();
        }
    }

    // Update the image transform based on scale and translation
    function updateImageTransform() {
        previewImage.style.transform = `scale(${imageScale}) translate(${imageTranslateX}px, ${imageTranslateY}px)`;
    }

    // Handle image dragging
    function startDrag(e) {
        if (isSelecting) return;
        
        isDragging = true;
        startX = e.clientX || e.touches[0].clientX;
        startY = e.clientY || e.touches[0].clientY;
        lastX = imageTranslateX;
        lastY = imageTranslateY;
        
        document.addEventListener('mousemove', dragImage);
        document.addEventListener('touchmove', dragImage, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }

    function dragImage(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        imageTranslateX = lastX + (clientX - startX) / imageScale;
        imageTranslateY = lastY + (clientY - startY) / imageScale;
        
        updateImageTransform();
    }

    function stopDrag() {
        if (isDragging) {
            isDragging = false;
            document.removeEventListener('mousemove', dragImage);
            document.removeEventListener('touchmove', dragImage);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);
            
            // Schedule OCR after dragging stops
            scheduleOCR();
        }
    }

    // Handle selection box
    function startSelection(e) {
        if (isDragging) return;
        
        isSelecting = true;
        const rect = previewImage.getBoundingClientRect();
        selectionStartX = (e.clientX || e.touches[0].clientX) - rect.left;
        selectionStartY = (e.clientY || e.touches[0].clientY) - rect.top;
        
        selectionBox.style.left = `${selectionStartX}px`;
        selectionBox.style.top = `${selectionStartY}px`;
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
        selectionBox.classList.remove('hidden');
        
        document.addEventListener('mousemove', updateSelection);
        document.addEventListener('touchmove', updateSelection, { passive: false });
        document.addEventListener('mouseup', endSelection);
        document.addEventListener('touchend', endSelection);
    }

    function updateSelection(e) {
        if (!isSelecting) return;
        
        e.preventDefault();
        
        const rect = previewImage.getBoundingClientRect();
        const currentX = (e.clientX || e.touches[0].clientX) - rect.left;
        const currentY = (e.clientY || e.touches[0].clientY) - rect.top;
        
        const width = currentX - selectionStartX;
        const height = currentY - selectionStartY;
        
        if (width > 0) {
            selectionBox.style.left = `${selectionStartX}px`;
            selectionBox.style.width = `${width}px`;
        } else {
            selectionBox.style.left = `${currentX}px`;
            selectionBox.style.width = `${-width}px`;
        }
        
        if (height > 0) {
            selectionBox.style.top = `${selectionStartY}px`;
            selectionBox.style.height = `${height}px`;
        } else {
            selectionBox.style.top = `${currentY}px`;
            selectionBox.style.height = `${-height}px`;
        }
    }

    function endSelection() {
        if (isSelecting) {
            isSelecting = false;
            document.removeEventListener('mousemove', updateSelection);
            document.removeEventListener('touchmove', updateSelection);
            document.removeEventListener('mouseup', endSelection);
            document.removeEventListener('touchend', endSelection);
            
            // Check if selection is too small
            const width = parseInt(selectionBox.style.width);
            const height = parseInt(selectionBox.style.height);
            
            if (width < 10 || height < 10) {
                // Selection too small, hide the box
                selectionBox.classList.add('hidden');
            } else {
                // Valid selection, perform OCR on the selected area
                scheduleOCR();
            }
        }
    }

    // Event listeners
    scanReceiptBtn.addEventListener('click', openScanner);
    closeBtn.addEventListener('click', closeScanner);
    captureBtn.addEventListener('click', captureImage);
    uploadBtn.addEventListener('click', () => {
        imageUploadInput.removeAttribute('capture');
        imageUploadInput.click();
    });
    
    imageUploadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                processImage(event.target.result);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
    
    zoomInBtn.addEventListener('click', () => zoomImage(true));
    zoomOutBtn.addEventListener('click', () => zoomImage(false));
    retryBtn.addEventListener('click', resetScannerUI);
    
    // Add touch/mouse events for image manipulation
    previewImage.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
            if (e.shiftKey) {
                startSelection(e);
            } else {
                startDrag(e);
            }
        }
    });
    
    previewImage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            startDrag(e);
        }
    });
    
    // Add double-tap to start selection on mobile
    let lastTap = 0;
    previewImage.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            // Double tap detected
            e.preventDefault();
            if (!isSelecting && !selectionBox.classList.contains('hidden')) {
                // If there's already a selection, clear it
                selectionBox.classList.add('hidden');
                scheduleOCR();
            } else {
                // Start a new selection
                startSelection({
                    touches: [{ clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }]
                });
            }
        }
        lastTap = currentTime;
    });

    // Log when the script is loaded
    console.log('OCR script loaded. Tesseract status:', 
        window.Tesseract ? 'Available' : 'Not available'
    );
});
