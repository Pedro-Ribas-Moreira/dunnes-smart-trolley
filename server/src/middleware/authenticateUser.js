import { adminAuth } from '../config/firebaseAdmin.js';

export async function authenticateUser(
  request,
  response,
  next,
) {
  const authorizationHeader =
    request.headers.authorization || '';

  if (
    !authorizationHeader.startsWith(
      'Bearer ',
    )
  ) {
    return response.status(401).json({
      success: false,
      error:
        'A Firebase authentication token is required.',
    });
  }

  const idToken = authorizationHeader
    .slice('Bearer '.length)
    .trim();

  if (!idToken) {
    return response.status(401).json({
      success: false,
      error:
        'A Firebase authentication token is required.',
    });
  }

  try {
    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    request.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
    };

    return next();
  } catch (error) {
    console.error(
      'Firebase token verification failed:',
      error.message,
    );

    return response.status(401).json({
      success: false,
      error:
        'The authentication token is invalid or expired.',
    });
  }
}