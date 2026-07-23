export async function mobileLog(message, data = null, level = 'LOG') {
  try {
    await fetch('/mobile-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        data,
        level,
        time: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Unable to send mobile log:', error);
  }
}   