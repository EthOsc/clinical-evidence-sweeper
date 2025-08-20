const fetch = require('node-fetch');

// AI Analysis Functions
const analyzeTrialDesign = (designModule) => {
  let score = 70; // Base score
  
  // Score based on actual trial characteristics
  if (designModule.studyType === 'INTERVENTIONAL') score += 10;
  if (designModule.phases && designModule.phases.includes('PHASE3')) score += 5;
  if (designModule.design && designModule.design.masking === 'DOUBLE') score += 15;
  
  const strengths = [];
  const weaknesses = [];
  
  // Real strengths based on design
  if (designModule.design && designModule.design.allocation === 'RANDOMIZED') {
    strengths.push("Randomized design");
  }
  if (designModule.enrollmentInfo && designModule.enrollmentInfo.count > 100) {
    strengths.push("Adequate sample size");
  } else {
    weaknesses.push("Small sample size");
  }
  
  if (designModule.design && designModule.design.masking === 'DOUBLE') {
    strengths.push("Double-blind design");
  } else {
    weaknesses.push("Lack of blinding");
  }
  
  if (designModule.design && designModule.design.interventionModel === 'PARALLEL') {
    strengths.push("Parallel group design");
  }
  
  return {
    score: Math.min(100, score), // Cap at 100
    strengths: strengths.length > 0 ? strengths : ["Standard study design"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["No major design flaws detected"],
    recommendations: weaknesses.length > 0 ? 
      ["Consider adding blinding where possible", "Increase sample size for better power"] : 
      ["Design appears solid - consider multi-center expansion"]
  };
};

const assessEnrollmentFeasibility = (eligibilityModule, statusModule) => {
  let score = 75;
  const challenges = [];
  
  if (eligibilityModule.eligibilityCriteria) {
    const criteria = eligibilityModule.eligibilityCriteria;
    
    // Check for restrictive criteria
    if (criteria.includes("exclusion") && (criteria.match(/exclusion/gi) || []).length > 5) {
      score -= 15;
      challenges.push("Many exclusion criteria may limit enrollment");
    }
    
    if (criteria.includes("18") && criteria.includes("65") && criteria.includes("years")) {
      score += 10; // Standard age range is good
    } else if (criteria.includes("18") && criteria.includes("80") && criteria.includes("years")) {
      score += 5; // Broad age range
    }
  }
  
  // Check based on current status
  if (statusModule.overallStatus === 'RECRUITING') {
    score += 5;
  } else if (statusModule.overallStatus === 'ACTIVE_NOT_RECRUITING') {
    score += 10; // Already enrolled participants
  }
  
  // Estimate duration based on enrollment
  const enrollment = statusModule.enrollmentInfo?.count || 100;
  let estimatedDuration = "12-18 months";
  
  if (enrollment > 500) {
    estimatedDuration = "18-24 months";
    challenges.push("Large enrollment target may extend timeline");
  } else if (enrollment < 50) {
    estimatedDuration = "6-12 months";
    score += 5; // Smaller studies enroll faster
  }
  
  return {
    score: Math.max(30, Math.min(100, score)), // Keep between 30-100
    estimatedDuration,
    challenges: challenges.length > 0 ? challenges : ["Standard enrollment expectations"]
  };
};

const estimateTrialCost = (designModule, statusModule) => {
  const phase = designModule.phases?.[0] || "PHASE2";
  const enrollment = designModule.enrollmentInfo?.count || statusModule.enrollmentInfo?.count || 100;
  
  let costPerPatient;
  switch(phase) {
    case "PHASE1": costPerPatient = 25000; break;
    case "PHASE2": costPerPatient = 15000; break;
    case "PHASE3": costPerPatient = 10000; break;
    default: costPerPatient = 8000;
  }
  
  // Adjust for study complexity
  if (designModule.studyType === 'INTERVENTIONAL') {
    costPerPatient *= 1.2;
  }
  
  if (designModule.design && designModule.design.masking === 'DOUBLE') {
    costPerPatient *= 1.1;
  }
  
  const estimatedCost = enrollment * costPerPatient;
  
  return {
    estimatedCost,
    costRange: `$${Math.round(estimatedCost * 0.8).toLocaleString()} - $${Math.round(estimatedCost * 1.2).toLocaleString()}`,
    factors: ["Phase of trial", "Enrollment size", "Study design complexity", "Number of study sites"],
    costPerPatient: `$${costPerPatient.toLocaleString()}`
  };
};

const calculateMarketOpportunity = (conditionsModule, designModule) => {
  const condition = conditionsModule.conditions?.[0] || "Unknown";
  const phase = designModule.phases?.[0] || "PHASE2";
  
  // These would be replaced with real market data API calls in production
  const marketSizes = {
    "cancer": { "PHASE1": 5000000, "PHASE2": 25000000, "PHASE3": 100000000 },
    "diabetes": { "PHASE1": 3000000, "PHASE2": 15000000, "PHASE3": 75000000 },
    "parkinson": { "PHASE1": 1000000, "PHASE2": 5000000, "PHASE3": 25000000 },
    "alzheimer": { "PHASE1": 2000000, "PHASE2": 10000000, "PHASE3": 50000000 },
    "cardiovascular": { "PHASE1": 4000000, "PHASE2": 20000000, "PHASE3": 90000000 }
  };
  
  // Find the best matching condition
  let matchedCondition = "other";
  for (const [key, value] of Object.entries(marketSizes)) {
    if (condition.toLowerCase().includes(key)) {
      matchedCondition = key;
      break;
    }
  }
  
  const defaultSize = { "PHASE1": 2000000, "PHASE2": 10000000, "PHASE3": 50000000 };
  const marketData = marketSizes[matchedCondition] || defaultSize;
  const marketSize = marketData[phase] || 10000000;
  
  return {
    estimatedMarket: marketSize,
    growthPotential: Math.floor(Math.random() * 20) + 5, // 5-25%
    conditionCategory: matchedCondition,
    phaseOpportunity: phase
  };
};

const predictTimeline = (statusModule, designModule) => {
  const status = statusModule.overallStatus || 'UNKNOWN';
  const startDate = statusModule.startDateStruct?.date;
  const completionDate = statusModule.primaryCompletionDateStruct?.date || statusModule.completionDateStruct?.date;
  const enrollment = designModule.enrollmentInfo?.count || statusModule.enrollmentInfo?.count || 100;
  
  let timelineStatus = "On track";
  let estimatedCompletion = completionDate || "Unknown";
  let riskFactors = [];
  
  if (status === 'RECRUITING') {
    // Estimate based on enrollment rate
    const monthsToComplete = enrollment < 100 ? 12 : enrollment < 500 ? 18 : 24;
    timelineStatus = "Recruiting - " + (enrollment < 50 ? "Early stage" : "Active");
    riskFactors.push("Recruitment pace may vary by region");
  } else if (status === 'ACTIVE_NOT_RECRUITING') {
    timelineStatus = "Enrollment complete - in progress";
    riskFactors.push("Follow-up phase typically has lower risk");
  } else if (status === 'COMPLETED') {
    timelineStatus = "Study completed";
  } else if (status === 'TERMINATED' || status === 'SUSPENDED') {
    timelineStatus = "Study interrupted";
    riskFactors.push("Investigate reasons for termination");
  }
  
  // Add risk based on phase
  const phase = designModule.phases?.[0] || "PHASE2";
  if (phase === "PHASE1") {
    riskFactors.push("Phase 1 trials have higher uncertainty");
  }
  
  return {
    status: timelineStatus,
    estimatedCompletion,
    riskFactors: riskFactors.length > 0 ? riskFactors : ["Standard trial timeline risks"],
    enrollmentProgress: enrollment < 100 ? "Early" : enrollment < 500 ? "Mid" : "Large"
  };
};

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
      
      // Base trial data
      const trialData = {
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
      
      // Always include AI analysis
      trialData.aiAnalysis = {
        designStrength: analyzeTrialDesign(designModule),
        enrollmentFeasibility: assessEnrollmentFeasibility(eligibilityModule, statusModule),
        estimatedCost: estimateTrialCost(designModule, statusModule),
        marketOpportunity: calculateMarketOpportunity(conditionsModule, designModule),
        timelinePrediction: predictTimeline(statusModule, designModule)
      };
      
      return trialData;
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
