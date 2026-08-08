export const compressImage = (base64: string, mimeType: string, maxSize: number = 1024, quality: number = 0.8): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `data:${mimeType};base64,${base64}`;
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            ctx.drawImage(img, 0, 0, width, height);

            // For JPEGs, we can control quality. For PNGs, it's lossless but resizing helps.
            const outputMimeType = 'image/jpeg';
            const compressedBase64 = canvas.toDataURL(outputMimeType, quality).split(',')[1];
            
            resolve({ base64: compressedBase64, mimeType: outputMimeType });
        };
        img.onerror = (error) => {
            reject(error);
        };
    });
};
