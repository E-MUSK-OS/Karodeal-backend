import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a base64 or raw buffer to Cloudinary
 * @param {string|Buffer} file - Base64 string or Buffer
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<string>} - Returns secure URL
 */
export const uploadToCloudinary = async (file, folder = 'karodeal') => {
  return new Promise((resolve, reject) => {
    let fileContent;
    if (Buffer.isBuffer(file)) {
      // If it's a buffer, convert to base64 for cloudinary uploader
      fileContent = `data:image/jpeg;base64,${file.toString('base64')}`;
    } else {
      fileContent = file;
    }
    
    cloudinary.uploader.upload(fileContent, { folder: folder, resource_type: 'auto' }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result.secure_url);
      }
    });
  });
};

/**
 * Deletes an image from Cloudinary using its URL
 * @param {string} imageUrl - The secure URL of the image
 */
export const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    const parts = imageUrl.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex !== -1) {
      let publicIdPath = parts.slice(uploadIndex + 1);
      if (publicIdPath[0].startsWith('v') && !isNaN(publicIdPath[0].slice(1))) {
        publicIdPath.shift();
      }
      const publicIdWithExt = publicIdPath.join('/');
      const publicId = publicIdWithExt.split('.').slice(0, -1).join('.');
      
      console.log('Attempting to delete Cloudinary publicId:', publicId);
      const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
      console.log('Cloudinary destroy result:', result);
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};
