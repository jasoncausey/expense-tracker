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
    const retryBtn = document.getElementById('retry-capture-btn');
    const detectedAmounts = document.getElementById('detected-amounts');
    const noAmountsMessage = document.getElementById('no-amounts-message');
    const expenseAmountInput = document.getElementById('expense-amount');

    // State variables
    let stream = null;
    let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let currentImage = null;
    
    // Add iOS class to body if on iOS device
    if (isIOS) {
        document.body.classList.add('ios-device');
    }
    
    // Selection state
    let isSelectionMode = false;
    let selectionStartX = 0;
    let selectionStartY = 0;
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
        
        // Ensure camera is fully stopped
        if (stream) {
            stream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
            stream = null;
        }
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
        isSelectionMode = false;
        selectionBox.classList.add('hidden');
        detectedAmounts.innerHTML = '';
        noAmountsMessage.classList.add('hidden');
        previewImage.src = '';
        
        // Clear any pending OCR timeout
        if (ocrTimeout) {
            clearTimeout(ocrTimeout);
            ocrTimeout = null;
        }
        
        // Only restart the camera if the scanner is still visible and not on iOS
        if (!isIOS && !scannerOverlay.classList.contains('hidden')) {
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
        
        // Set instructions based on device type
        const previewImageContainer = document.getElementById('preview-image-container');
        previewImageContainer.setAttribute('data-instruction', 'Tap to select area');
        
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
    async function performOCR(useHighAccuracy = false) {
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
                
                // Configure logger for progress updates
                const logger = m => {
                    console.log('Tesseract progress:', m);
                    if (m.status === 'recognizing text') {
                        loadingEl.textContent = `Processing: ${Math.round(m.progress * 100)}%`;
                    }
                };
                
                // Create a worker with the appropriate options
                // In v6.0.1, the createWorker function takes language, OEM, and options
                let worker;
                try {
                    worker = await window.Tesseract.createWorker('eng', useHighAccuracy ? 1 : 0, {
                        logger,
                        // Use higher quality settings for high accuracy mode
                        ...(useHighAccuracy ? {
                            engineMode: 1, // Tesseract only (more accurate)
                        } : {})
                    });
                } catch (error) {
                    console.error('Error creating Tesseract worker:', error);
                    
                    // Fallback to simpler worker creation if the above fails
                    console.log('Trying fallback worker creation method...');
                    worker = await window.Tesseract.createWorker({
                        logger,
                        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
                        lang: 'eng',
                        oem: useHighAccuracy ? 1 : 0,
                        ...(useHighAccuracy ? {
                            engineMode: 1, // Tesseract only (more accurate)
                        } : {})
                    });
                }
                
                if (useHighAccuracy) {
                    loadingEl.textContent = 'Processing with high accuracy (this may take longer)...';
                }
                
                try {
                    // Perform OCR using the worker
                    const { data } = await worker.recognize(canvas);
                    console.log('Tesseract result:', data);
                    
                    if (data && data.text) {
                        processOCRResult(data.text, useHighAccuracy, data.words || []);
                    } else {
                        noAmountsMessage.classList.remove('hidden');
                    }
                } catch (error) {
                    console.error('Tesseract processing error:', error);
                    noAmountsMessage.classList.remove('hidden');
                } finally {
                    // Always terminate the worker when done
                    await worker.terminate();
                }
            } else {
                throw new Error('Tesseract not available globally');
            }
        } catch (error) {
            console.error('Error using Tesseract:', error);
            noAmountsMessage.classList.remove('hidden');
        } finally {
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

    // Handle image click/tap for selection
    function handleImageClick(e) {
        e.preventDefault();
        
        const rect = previewImage.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        if (!isSelectionMode) {
            // Start selection
            isSelectionMode = true;
            selectionStartX = x;
            selectionStartY = y;
            
            // Show selection box at initial point
            selectionBox.style.left = `${x}px`;
            selectionBox.style.top = `${y}px`;
            selectionBox.style.width = '0';
            selectionBox.style.height = '0';
            selectionBox.classList.remove('hidden');
            
            // Update instruction
            const previewImageContainer = document.getElementById('preview-image-container');
            previewImageContainer.setAttribute('data-instruction', 'Tap again to complete selection');
        } else {
            // Complete selection
            isSelectionMode = false;
            
            // Calculate width and height
            const width = x - selectionStartX;
            const height = y - selectionStartY;
            
            // Handle negative dimensions (selection from right to left or bottom to top)
            if (width < 0) {
                selectionBox.style.left = `${x}px`;
                selectionBox.style.width = `${-width}px`;
            } else {
                selectionBox.style.width = `${width}px`;
            }
            
            if (height < 0) {
                selectionBox.style.top = `${y}px`;
                selectionBox.style.height = `${-height}px`;
            } else {
                selectionBox.style.height = `${height}px`;
            }
            
            // Check if selection is too small
            const finalWidth = parseInt(selectionBox.style.width);
            const finalHeight = parseInt(selectionBox.style.height);
            
            if (finalWidth < 10 || finalHeight < 10) {
                // Selection too small, hide the box
                selectionBox.classList.add('hidden');
                
                // Reset instruction
                const previewImageContainer = document.getElementById('preview-image-container');
                previewImageContainer.setAttribute('data-instruction', 'Tap to select area');
            } else {
                // Update instruction
                const previewImageContainer = document.getElementById('preview-image-container');
                previewImageContainer.setAttribute('data-instruction', 'Processing selected area');
                
                // Perform OCR on the selected area
                scheduleOCR();
            }
        }
    }

    // Handle image move during selection
    function handleImageMove(e) {
        if (!isSelectionMode) return;
        
        e.preventDefault();
        
        const rect = previewImage.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        // Calculate width and height
        const width = x - selectionStartX;
        const height = y - selectionStartY;
        
        // Handle negative dimensions (selection from right to left or bottom to top)
        if (width < 0) {
            selectionBox.style.left = `${x}px`;
            selectionBox.style.width = `${-width}px`;
        } else {
            selectionBox.style.left = `${selectionStartX}px`;
            selectionBox.style.width = `${width}px`;
        }
        
        if (height < 0) {
            selectionBox.style.top = `${y}px`;
            selectionBox.style.height = `${-height}px`;
        } else {
            selectionBox.style.top = `${selectionStartY}px`;
            selectionBox.style.height = `${height}px`;
        }
    }

    // Cancel selection
    function cancelSelection() {
        if (isSelectionMode) {
            isSelectionMode = false;
            selectionBox.classList.add('hidden');
            
            // Reset instruction
            const previewImageContainer = document.getElementById('preview-image-container');
            previewImageContainer.setAttribute('data-instruction', 'Tap to select area');
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
    
    retryBtn.addEventListener('click', resetScannerUI);
    
    // Add event listeners for selection
    previewImage.addEventListener('mousedown', handleImageClick);
    previewImage.addEventListener('touchstart', handleImageClick, { passive: false });
    
    previewImage.addEventListener('mousemove', handleImageMove);
    previewImage.addEventListener('touchmove', handleImageMove, { passive: false });
    
    // Cancel selection on right-click or long press
    previewImage.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        cancelSelection();
    });
    
    // Add CSS animation for selection feedback
    const style = document.createElement('style');
    style.textContent = `
        #selection-box {
            position: absolute;
            border: 2px dashed #0056b3;
            background-color: rgba(0, 86, 179, 0.1);
            pointer-events: none;
            z-index: 10;
        }
        
        #preview-image-container::after {
            content: attr(data-instruction);
            position: absolute;
            bottom: 10px;
            left: 0;
            right: 0;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px;
            font-size: 0.9rem;
            text-align: center;
            pointer-events: none;
            opacity: 0.9;
            transition: opacity 0.3s;
        }
    `;
    document.head.appendChild(style);

    // Log when the script is loaded
    console.log('OCR script loaded. Tesseract status:', 
        window.Tesseract ? 'Available' : 'Not available'
    );
});
