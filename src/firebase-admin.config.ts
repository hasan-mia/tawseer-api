import * as admin from 'firebase-admin';
import serviceAccount from './firebase-adminsdk.json';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
}

export default admin;