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
 * Search for a company using SearXNG
 *
 * SearXNG is a free, privacy-respecting metasearch engine that aggregates results
 * from multiple search engines. No API key required!
 *
 * Default instance: https://searx.be
 * You can change this by setting SEARXNG_INSTANCE in .env.local
 *
 * Find more public instances at: https://searx.space/
 *
 * The function returns an array of SearchResult objects with:
 * - title: The title of the search result
 * - snippet: A short description or snippet
 * - url: The URL of the result
 */
async function searchCompany(query: string): Promise<SearchResult[]> {
  console.log(`Searching for: ${query}`);

  try {
    // Using SearXNG public instance
    // You can change this to any SearXNG instance or your own self-hosted one
    const SEARXNG_INSTANCE = process.env.SEARXNG_INSTANCE || 'https://searx.be';

    const searchUrl = new URL(`${SEARXNG_INSTANCE}/search`);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('categories', 'general');

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CompanyEnricher/1.0)',
      },
    });

    if (!response.ok) {
      console.error(`SearXNG error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.slice(0, 10).map((item: any) => ({
      title: item.title || '',
      snippet: item.content || '',
      url: item.url || '',
    }));
  } catch (error) {
    console.error('SearXNG search error:', error);
    return [];
  }
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
