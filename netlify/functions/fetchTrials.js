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

    // Build ClinicalTrials.gov API URL
    const baseUrl = 'https://clinicaltrials.gov/api/query/study_fields';
    const params = new URLSearchParams({
      'expr': condition,
      'fields': 'NCTId,BriefTitle,Condition,Phase,StudyType,PrimaryCompletionDate,LocationFacility,LocationCity,LocationState,LocationCountry,OverallStatus,BriefSummary,DetailedDescription,EligibilityCriteria,MinimumAge,MaximumAge,EnrollmentCount',
      'min_rnk': ((page - 1) * 20) + 1,
      'max_rnk': page * 20,
      'fmt': 'json'
    });

    // Add additional filters if provided
    if (location) {
      params.append('locn', location);
    }
    
    if (status) {
      params.append('recrs', status);
    }

    const apiUrl = `${baseUrl}?${params}`;
    console.log('Fetching from:', apiUrl);

    // Fetch data from ClinicalTrials.gov
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Clinical-Trials-Sweeper/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`ClinicalTrials.gov API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Process and clean the data
    const processedTrials = data.StudyFieldsResponse?.StudyFields?.map(study => {
      return {
        nctId: study.NCTId?.[0] || 'N/A',
        title: study.BriefTitle?.[0] || 'N/A',
        condition: study.Condition?.join(', ') || condition,
        phase: study.Phase?.[0] || 'N/A',
        studyType: study.StudyType?.[0] || 'N/A',
        status: study.OverallStatus?.[0] || 'N/A',
        completionDate: study.PrimaryCompletionDate?.[0] || 'N/A',
        location: formatLocation(study),
        briefSummary: study.BriefSummary?.[0] || 'N/A',
        detailedDescription: study.DetailedDescription?.[0] || 'N/A',
        eligibility: study.EligibilityCriteria?.[0] || 'N/A',
        minAge: study.MinimumAge?.[0] || 'N/A',
        maxAge: study.MaximumAge?.[0] || 'N/A',
        enrollment: study.EnrollmentCount?.[0] || 'N/A',
        url: `https://clinicaltrials.gov/ct2/show/${study.NCTId?.[0]}`
      };
    }) || [];

    // Filter by age if specified
    const filteredTrials = filterByAge(processedTrials, minAge, maxAge);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        trials: filteredTrials,
        totalResults: data.StudyFieldsResponse?.NStudiesReturned || 0,
        totalAvailable: data.StudyFieldsResponse?.NStudiesAvail || 0,
        page: parseInt(page),
        searchParams: { condition, location, status, minAge, maxAge }
      })
    };

  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch clinical trials data',
        details: error.message 
      })
    };
  }
};

// Helper function to format location data
function formatLocation(study) {
  const facilities = study.LocationFacility || [];
  const cities = study.LocationCity || [];
  const states = study.LocationState || [];
  const countries = study.LocationCountry || [];
  
  if (facilities.length === 0) return 'Location not specified';
  
  // Take the first location for simplicity
  const facility = facilities[0];
  const city = cities[0] || '';
  const state = states[0] || '';
  const country = countries[0] || '';
  
  let location = facility;
  if (city) location += `, ${city}`;
  if (state) location += `, ${state}`;
  if (country && country !== 'United States') location += `, ${country}`;
  
  return location;
}

// Helper function to filter trials by age
function filterByAge(trials, minAge, maxAge) {
  if (!minAge && !maxAge) return trials;
  
  return trials.filter(trial => {
    const trialMinAge = parseAge(trial.minAge);
    const trialMaxAge = parseAge(trial.maxAge);
    
    if (minAge && trialMaxAge < parseInt(minAge)) return false;
    if (maxAge && trialMinAge > parseInt(maxAge)) return false;
    
    return true;
  });
}

// Helper function to parse age strings
function parseAge(ageString) {
  if (!ageString || ageString === 'N/A') return null;
  const match = ageString.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}
