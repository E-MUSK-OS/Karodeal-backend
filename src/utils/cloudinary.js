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
