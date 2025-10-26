import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

try {
    if (!admin.apps.length) {
        const serviceAccountPath = path.join(__dirname, 'firebase-adminsdk.json');

        // Check if file exists
        if (!fs.existsSync(serviceAccountPath)) {
            throw new Error(`Service account file not found at: ${serviceAccountPath}`);
        }

        // Read and parse the file
        const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountContent);

        // Verify required fields
        const requiredFields = ['project_id', 'private_key', 'client_email'];
        for (const field of requiredFields) {
            if (!serviceAccount[field]) {
                throw new Error(`Missing required field in service account: ${field}`);
            }
        }

        console.log('✅ Initializing Firebase Admin SDK...');
        console.log('📋 Project ID:', serviceAccount.project_id);
        console.log('📧 Client Email:', serviceAccount.client_email);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });

        console.log('✅ Firebase Admin SDK initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    throw error;
}

export default admin;