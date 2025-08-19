const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters;
    const baseUrl = 'https://clinicaltrials.gov/api/v2/studies';
    const queryParams = new URLSearchParams();
    
    if (params.condition) queryParams.set('query.cond', params.condition);
    if (params.intervention) queryParams.set('query.intr', params.intervention);
    if (params.status) queryParams.set('query.recr', params.status);
    if (params.phase) queryParams.set('query.phase', params.phase);
    if (params.country) queryParams.set('query.locn', params.country);
    if (params.sponsor) queryParams.set('query.spons', params.sponsor);
    
    queryParams.set('format', 'json');
    queryParams.set('pageSize', '25');
    
    const apiUrl = `${baseUrl}?${queryParams.toString()}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch trials" }),
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      }
    };
  }
};
