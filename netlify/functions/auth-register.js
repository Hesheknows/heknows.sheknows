// netlify/functions/auth-register.js

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = 'https://ydqcxbwxfzyxdzidalch.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkcWN4Ynd4Znp5eGR6aWRhZmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTczMjMsImV4cCI6MjA5NDc3MzMyM30.a8t8km5BIYODC6Sp_rWE8XCJ1yfHwfdcLjrpN5nBms0';

  try {
    const { email, password } = JSON.parse(event.body);

    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    return {
      statusCode: res.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
