const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Get query parameters
    const { condition, location, status, minAge, maxAge, page = 1 } = event.queryStringParameters || {};
    
    if (!condition) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Condition parameter is required' })
      };
    }

    // Build ClinicalTrials.gov API v2 URL with correct format
    const baseUrl = 'https://clinicaltrials.gov/api/v2/studies';
    
    // Build query parameters according to v2 API spec
    const queryParams = {
      'format': 'json',
      'pageSize': 20
    };

    // Add condition search - using the correct parameter name
    queryParams['query.cond'] = condition;

    // Add location filter if provided
    if (location) {
      queryParams['query.locn'] = location;
    }
    
    // Add status filter if provided  
    if (status) {
      queryParams['filter.overallStatus'] = status;
    }

    // Add pagination (note: v2 API uses different pagination)
    if (page > 1) {
      queryParams['pageToken'] = ((page - 1) * 20).toString();
    }

    const params = new URLSearchParams(queryParams);
    const apiUrl = `${baseUrl}?${params}`;
    console.log('Fetching from:', apiUrl);

    // Fetch data from ClinicalTrials.gov v2 API
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Clinical-Trials-Sweeper/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`ClinicalTrials.gov API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API Response structure:', Object.keys(data));
    
    // Process and clean the data for v2 API format
    const studies = data.studies || [];
    const processedTrials = studies.map(study => {
      const protocolSection = study.protocolSection || {};
      const identificationModule = protocolSection.identificationModule || {};
      const statusModule = protocolSection.statusModule || {};
      const designModule = protocolSection.designModule || {};
      const conditionsModule = protocolSection.conditionsModule || {};
      const descriptionModule = protocolSection.descriptionModule || {};
      const eligibilityModule = protocolSection.eligibilityModule || {};
      const contactsLocationsModule = protocolSection.contactsLocationsModule || {};
      
      return {
        nctId: identificationModule.nctId || 'N/A',
        title: identificationModule.briefTitle || 'N/A',
        condition: conditionsModule.conditions?.join(', ') || condition,
        phase: designModule.phases?.join(', ') || 'N/A',
        studyType: designModule.studyType || 'N/A',
        status: statusModule.overallStatus || 'N/A',
        completionDate: statusModule.primaryCompletionDateStruct?.date || statusModule.completionDateStruct?.date || 'N/A',
        location: formatLocationV2(contactsLocationsModule),
        briefSummary: descriptionModule.briefSummary || 'N/A',
        detailedDescription: descriptionModule.detailedDescription || 'N/A',
        eligibility: eligibilityModule.eligibilityCriteria || 'N/A',
        minAge: eligibilityModule.minimumAge || 'N/A',
        maxAge: eligibilityModule.maximumAge || 'N/A',
        enrollment: designModule.enrollmentInfo?.count || statusModule.enrollmentInfo?.count || 'N/A',
        url: `https://clinicaltrials.gov/study/${identificationModule.nctId || 'unknown'}`
      };
    });

    // Filter by age if specified
    const filteredTrials = filterByAge(processedTrials, minAge, maxAge);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        trials: filteredTrials,
        totalResults: studies.length,
        totalAvailable: data.totalCount || studies.length,
        page: parseInt(page),
        searchParams: { condition, location, status, minAge, maxAge },
        apiResponse: data.studies ? 'v2 API working' : 'unexpected format'
      })
    };

  } catch (error) {
    console.error('Error details:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch clinical trials data',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

// Helper function to format location data for v2 API
function formatLocationV2(contactsLocationsModule) {
  const locations = contactsLocationsModule?.locations;
  
  if (!locations || locations.length === 0) {
    return 'Location not specified';
  }
  
  // Take the first location
  const location = locations[0];
  const facility = location.facility || '';
  const city = location.city || '';
  const state = location.state || '';
  const country = location.country || '';
  
  let locationStr = facility;
  if (city) locationStr += `, ${city}`;
  if (state) locationStr += `, ${state}`;
  if (country && country !== 'United States') locationStr += `, ${country}`;
  
  return locationStr || 'Location not specified';
}

// Helper function to filter trials by age
function filterByAge(trials, minAge, maxAge) {
  if (!minAge && !maxAge) return trials;
  
  return trials.filter(trial => {
    const trialMinAge = parseAge(trial.minAge);
    const trialMaxAge = parseAge(trial.maxAge);
    
    if (minAge && trialMaxAge !== null && trialMaxAge < parseInt(minAge)) return false;
    if (maxAge && trialMinAge !== null && trialMinAge > parseInt(maxAge)) return false;
    
    return true;
  });
}

// Helper function to parse age strings
function parseAge(ageString) {
  if (!ageString || ageString === 'N/A') return null;
  const match = ageString.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}
