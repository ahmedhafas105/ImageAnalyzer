// File: backend/auth-middleware.js
const admin = require('firebase-admin');

// This check prevents initializing the app more than once, which can cause errors.
if (!admin.apps.length) {
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function verifyFirebaseToken(request, context) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: { status: 401, body: 'Unauthorized: No token provided.' } };
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return { user: decodedToken };
    } catch (error) {
        context.error('Token verification failed:', error);
        return { error: { status: 403, body: 'Unauthorized: Invalid token.' } };
    }
}

module.exports = { verifyFirebaseToken };