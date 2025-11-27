import { NextRequest, NextResponse } from 'next/server';
import { SearchConfig, SearchResult, EnrichmentResponse } from '@/types';

// Blocked domains that are not useful for finding company websites
const BLOCKED_DOMAINS = [
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'crunchbase.com',
  'glassdoor.com',
  'indeed.com',
  'yell.com',
  'yellowpages.com',
  'kompass.com',
  'companieshouse.gov.uk',
  'dnb.com',
  'bloomberg.com',
  'zoominfo.com',
  'yelp.com',
  'bbb.org',
];

/**
 * Search for a company using a search API
 *
 * IMPORTANT: Replace this function with your actual search API implementation
 *
 * Example implementations:
 *
 * 1. DuckDuckGo Instant Answer API (Limited):
 *    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
 *
 * 2. SerpAPI (Paid, recommended):
 *    const response = await fetch(
 *      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=YOUR_API_KEY`
 *    );
 *
 * 3. Google Custom Search API (Paid):
 *    const response = await fetch(
 *      `https://www.googleapis.com/customsearch/v1?key=YOUR_API_KEY&cx=YOUR_CX&q=${encodeURIComponent(query)}`
 *    );
 *
 * 4. Brave Search API (Paid):
 *    const response = await fetch(
 *      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
 *      { headers: { 'X-Subscription-Token': 'YOUR_API_KEY' } }
 *    );
 *
 * The function should return an array of SearchResult objects with:
 * - title: The title of the search result
 * - snippet: A short description or snippet
 * - url: The URL of the result
 */
async function searchCompany(query: string): Promise<SearchResult[]> {
  // ============================================================
  // TODO: REPLACE THIS WITH YOUR ACTUAL SEARCH API IMPLEMENTATION
  // ============================================================

  // For demonstration, using a mock implementation
  // In production, uncomment and configure one of the API examples above

  console.log(`Searching for: ${query}`);

  // Example: Using Google Custom Search API (you need to enable it and get credentials)
  /*
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const GOOGLE_CX = process.env.GOOGLE_CX;

  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    throw new Error('Google API credentials not configured');
  }

  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10`
  );

  if (!response.ok) {
    throw new Error(`Search API error: ${response.statusText}`);
  }

  const data = await response.json();

  return (data.items || []).map((item: any) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
  }));
  */

  // Example: Using SerpAPI (recommended for production)
  /*
  const SERPAPI_KEY = process.env.SERPAPI_KEY;

  if (!SERPAPI_KEY) {
    throw new Error('SerpAPI key not configured');
  }

  const response = await fetch(
    `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=10`
  );

  if (!response.ok) {
    throw new Error(`Search API error: ${response.statusText}`);
  }

  const data = await response.json();

  return (data.organic_results || []).map((item: any) => ({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
  }));
  */

  // MOCK IMPLEMENTATION - Remove this in production
  // This simulates search results for testing purposes
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

  return [
    {
      title: `${query} - Official Website`,
      snippet: 'Official website of the company',
      url: `https://example.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
    },
    {
      title: `${query} | LinkedIn`,
      snippet: 'LinkedIn profile',
      url: 'https://linkedin.com/company/example',
    },
  ];
}

/**
 * Build a search query from the template and configuration
 */
function buildQuery(companyName: string, config: SearchConfig): string {
  let query = config.searchTemplate || '{{company}} {{extra}} {{country}}';

  // Replace placeholders
  query = query.replace(/\{\{company\}\}/g, companyName);
  query = query.replace(/\{\{extra\}\}/g, config.extraKeywords || '');
  query = query.replace(/\{\{country\}\}/g, config.countryHint || '');

  // Clean up multiple spaces and trim
  query = query.replace(/\s+/g, ' ').trim();

  // If the template is empty or resulted in empty query, use fallback
  if (!query || query === '') {
    const parts = [companyName, config.extraKeywords, config.countryHint].filter(
      (part) => part && part.trim() !== ''
    );
    query = parts.join(' ');
  }

  return query;
}

/**
 * Check if a URL belongs to a blocked domain
 */
function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some((domain) =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Select the best website from search results
 */
function selectWebsite(
  results: SearchResult[],
  companyName: string
): { website: string; status: 'auto' | 'needs_review' } {
  // Filter out blocked domains
  const filteredResults = results.filter((result) => !isBlockedDomain(result.url));

  if (filteredResults.length === 0) {
    return { website: '', status: 'needs_review' };
  }

  // Prefer results where title contains the company name (case insensitive)
  const companyNameLower = companyName.toLowerCase();
  const matchingResult = filteredResults.find((result) =>
    result.title.toLowerCase().includes(companyNameLower)
  );

  if (matchingResult) {
    return { website: matchingResult.url, status: 'auto' };
  }

  // Otherwise, use the first non-blocked result
  return { website: filteredResults[0].url, status: 'auto' };
}

/**
 * POST /api/enrich
 * Enriches a single company with website information
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company, config } = body as {
      company: string;
      config: SearchConfig;
    };

    if (!company || !config) {
      return NextResponse.json(
        { error: 'Missing company or config' },
        { status: 400 }
      );
    }

    // Build the search query
    const searchQuery = buildQuery(company, config);

    // Search for the company
    const searchResults = await searchCompany(searchQuery);

    // Select the best website from results
    const { website, status } = selectWebsite(searchResults, company);

    const response: EnrichmentResponse = {
      company_name: company,
      website,
      status,
      search_query: searchQuery,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Enrichment error:', error);
    return NextResponse.json(
      { error: 'Failed to enrich company' },
      { status: 500 }
    );
  }
}
