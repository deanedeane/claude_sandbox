# Company Website Enricher

A simple, opinionated web application that enriches a list of company names with their websites using search APIs.

## Features

- **CSV Upload**: Upload a CSV file with a `company_name` column
- **Text Input**: Alternatively, paste company names (one per line)
- **Configurable Search**: Customize search queries with extra keywords, country hints, and templates
- **Smart Website Selection**: Automatically filters out social media and directory sites
- **Manual Editing**: Edit website URLs directly in the results table
- **Status Tracking**: Automatic status indicators (`auto` or `needs_review`)
- **Retry Functionality**: Retry search for individual companies
- **Filter Results**: Toggle to show only companies that need review
- **CSV Export**: Download enriched results as CSV

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Configuration

### Search API Setup

The application uses a mock search implementation by default. To use a real search API:

1. Open `app/api/enrich/route.ts`
2. Find the `searchCompany` function (around line 50)
3. Choose one of the provided API examples and uncomment it
4. Add your API credentials to `.env.local`:

```env
# Example for Google Custom Search
GOOGLE_API_KEY=your_api_key_here
GOOGLE_CX=your_custom_search_engine_id

# Example for SerpAPI (recommended)
SERPAPI_KEY=your_serpapi_key_here

# Example for Brave Search
BRAVE_API_KEY=your_brave_api_key_here
```

### Supported Search APIs

The code includes commented examples for:

1. **Google Custom Search API** (Paid) - 100 free queries/day, then $5 per 1000 queries
2. **SerpAPI** (Paid, recommended) - Easy to use, reliable results
3. **Brave Search API** (Paid) - Privacy-focused alternative
4. **DuckDuckGo API** (Free, limited) - Very limited functionality

## Usage

### 1. Input Companies

Choose one of two input methods:

- **CSV Upload**: Upload a CSV file with at least a `company_name` column
- **Text Input**: Paste company names, one per line

Example CSV:
```csv
company_name
Acme Corporation
Tech Solutions Inc
Global Industries Ltd
```

### 2. Configure Search

Customize the search parameters:

- **Extra Keywords**: Add industry-specific terms (e.g., "accounting", "bookkeeping")
- **Country Hint**: Specify location (e.g., "Australia", "United States")
- **Search Template**: Customize query format (default: `{{company}} {{extra}} {{country}}`)

Template placeholders:
- `{{company}}` - Company name
- `{{extra}}` - Extra keywords
- `{{country}}` - Country hint

### 3. Start Enrichment

Click "Start Enrichment" to begin. The app processes companies in batches of 5 to avoid rate limiting.

### 4. Review Results

The results table shows:
- **Company Name**: Original company name
- **Website**: Found website (editable)
- **Status**: `auto` (confident) or `needs_review` (uncertain)
- **Search Query**: The actual query used
- **Actions**: Retry search button

### 5. Export Results

Click "Download CSV" to export the enriched data.

## How It Works

### Query Building

1. Takes the search template (default: `{{company}} {{extra}} {{country}}`)
2. Replaces placeholders with actual values
3. Cleans up extra spaces

Example:
- Company: "Acme Corp"
- Extra Keywords: "accounting"
- Country: "Australia"
- Result: "Acme Corp accounting Australia"

### Website Selection Logic

1. **Fetch search results** using the configured API
2. **Filter out blocked domains**:
   - Social media (LinkedIn, Facebook, Twitter/X)
   - Business directories (Crunchbase, Glassdoor, Indeed)
   - Generic directories (Yellow Pages, Yell, Kompass)
   - Registry sites (Companies House)
3. **Prioritize results**:
   - First choice: Results where title contains the company name
   - Fallback: First non-blocked result
   - If no results: Empty website with `needs_review` status

### Status Indicators

- **auto** (green): Website found with confidence
- **needs_review** (yellow): Uncertain result or no website found

## Project Structure

```
website-enricher/
├── app/
│   ├── api/
│   │   └── enrich/
│   │       └── route.ts          # API endpoint for enrichment
│   ├── page.tsx                   # Main UI component
│   └── layout.tsx                 # Root layout
├── types/
│   └── index.ts                   # TypeScript interfaces
├── package.json
└── README.md
```

## Customization

### Add More Blocked Domains

Edit the `BLOCKED_DOMAINS` array in `app/api/enrich/route.ts`:

```typescript
const BLOCKED_DOMAINS = [
  'linkedin.com',
  'facebook.com',
  // Add more domains here
  'yourdomain.com',
];
```

### Change Batch Size

In `app/page.tsx`, modify the `batchSize` variable (default is 5):

```typescript
const batchSize = 10; // Process 10 companies at a time
```

### Adjust Selection Logic

Modify the `selectWebsite` function in `app/api/enrich/route.ts` to change how websites are selected from search results.

## Development

### Build for Production

```bash
npm run build
```

### Run Production Build

```bash
npm start
```

### Type Checking

```bash
npm run lint
```

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Choose one search API and add its credentials

# Google Custom Search
GOOGLE_API_KEY=
GOOGLE_CX=

# SerpAPI (recommended)
SERPAPI_KEY=

# Brave Search
BRAVE_API_KEY=
```

## License

This is an internal tool for personal use. Use at your own discretion.

## Troubleshooting

### "No results found" for all companies

- Check that your search API is configured correctly
- Verify API credentials in `.env.local`
- Check API quota/rate limits
- Review the browser console for error messages

### CSV upload not working

- Ensure the CSV has a `company_name` column (exact name)
- Check that the file is valid CSV format
- Try the text input method as an alternative

### Application won't start

- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (requires Node 18+)
- Clear `.next` folder and rebuild: `rm -rf .next && npm run dev`
