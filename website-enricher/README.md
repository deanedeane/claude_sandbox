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

### Search Engine - SearXNG

The application uses **SearXNG**, a free, privacy-respecting metasearch engine that requires **no API keys**!

**Default Instance**: `https://searx.be`

SearXNG aggregates results from multiple search engines (Google, Bing, DuckDuckGo, etc.) while respecting your privacy.

#### Optional: Use a Different SearXNG Instance

If you want to use a different public instance or self-host your own:

1. Create a `.env.local` file in the root directory:

```env
SEARXNG_INSTANCE=https://search.bus-hit.me
```

2. Choose from popular public instances:
   - `https://searx.be` (Belgium, default)
   - `https://search.bus-hit.me` (Germany)
   - `https://searx.tiekoetter.com` (Germany)
   - `https://searx.work` (United States)
   - `https://search.sapti.me` (France)

Find more instances at: [https://searx.space/](https://searx.space/)

#### Self-Hosting SearXNG (Optional)

For maximum reliability and control, you can self-host SearXNG:

```bash
# Using Docker
docker run -d -p 8080:8080 searxng/searxng

# Then in .env.local:
SEARXNG_INSTANCE=http://localhost:8080
```

Full documentation: [https://docs.searxng.org/](https://docs.searxng.org/)

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

**No environment variables required!** The application works out of the box with SearXNG.

Optional: Create a `.env.local` file to use a different SearXNG instance:

```env
# Optional: Use a different SearXNG instance (default is https://searx.be)
SEARXNG_INSTANCE=https://search.bus-hit.me
```

## License

This is an internal tool for personal use. Use at your own discretion.

## Troubleshooting

### "No results found" for all companies

- The default SearXNG instance (searx.be) might be down or rate-limiting
- Try switching to a different SearXNG instance in `.env.local`
- Check your internet connection
- Review the browser console and server logs for error messages
- Try a different public instance from https://searx.space/

### CSV upload not working

- Ensure the CSV has a `company_name` column (exact name)
- Check that the file is valid CSV format
- Try the text input method as an alternative

### Application won't start

- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (requires Node 18+)
- Clear `.next` folder and rebuild: `rm -rf .next && npm run dev`
