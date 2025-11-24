# 💰 Household Finance Analyzer

A web-based tool to analyze household spending from Monzo and Amex transaction exports. Features intelligent merchant deduplication, AI-powered categorization, and comprehensive spending analysis.

## Features

- **Multi-account support**: Import files from 5 accounts (Deane Monzo, Thea Monzo, Joint Monzo, Gold Amex, BA Amex)
- **Multiple file formats**: Supports both CSV and Excel (XLS/XLSX) files
- **Excel sheet selection**: Automatically detects multiple sheets and lets you choose the right one
- **Merchant deduplication**: Standardize merchant names (e.g., "AMAZON.CO.UK" → "Amazon")
- **Smart categorization**: AI-powered category assignment using OpenAI
- **Mapping persistence**: Save and reuse your deduplication and category mappings
- **Internal transfer detection**: Automatically identifies and excludes transfers between accounts
- **Date filtering**: Filter analysis by date range to focus on specific months or periods
- **Comprehensive analysis**: View spending by category, account, merchant, and month
- **Interactive editing**: Edit merchant names and categories in the web interface
- **Export capabilities**: Download processed data and mappings for future use

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure OpenAI API Key

Create a `.env` file in the project directory:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-key-here
```

Alternatively, you can enter the API key directly in the web interface.

### 3. Run the Application

```bash
streamlit run app.py
```

The application will open in your browser at `http://localhost:8501`

## Usage

### First Time Setup

1. **Upload Transaction Files**
   - Export your transactions as CSV or Excel from Monzo and Amex
   - Upload the files for each account in the sidebar (CSV, XLS, or XLSX)
   - You don't need to upload all 5 accounts - just the ones you have data for

2. **Select Excel Sheets** (if applicable)
   - If any Excel file has multiple sheets, you'll be prompted to select which one contains your transactions
   - The app auto-detects this and shows you the available sheets

3. **Review Merchant Deduplication**
   - The system automatically suggests standardized merchant names
   - Edit any that don't look correct
   - This consolidates variations like "AMAZON.CO.UK", "Amazon UK" → "Amazon"

4. **Review Category Mapping**
   - AI will automatically categorize merchants using your OpenAI API key
   - Review and edit categories as needed
   - Available categories: Groceries, Eating out, Transport, Shopping, Entertainment, Income, Bills, Holidays, Fitness, Personal care, General, Transfers, Uncategorized

5. **View Analysis**
   - Use the date range filter to focus on specific time periods (e.g., single month)
   - See spending summaries by category, account, and merchant
   - View monthly trends if data spans multiple months
   - Browse all transactions in detail

6. **Export Mappings**
   - Download `merchant_mapping.csv` - your merchant deduplication rules
   - Download `category_mapping.csv` - your category assignments
   - Download `transactions_analyzed.csv` - all processed transactions
   - **Save these files!** They'll make next month much faster

### Subsequent Months

1. Upload your new transaction CSV files
2. **Upload your previous mapping files** (merchant_mapping.csv and category_mapping.csv)
3. The system will automatically apply your existing rules
4. Only new merchants will need AI classification
5. Review, adjust if needed, and export updated mappings

## File Formats

### Supported File Types
- **CSV** (.csv)
- **Excel** (.xlsx, .xls)

The app automatically detects the format and parses accordingly. For Excel files with multiple sheets, you'll be prompted to select the correct sheet.

### Expected Data Formats

#### Monzo (CSV or Excel)
- Required columns: `Date`, `Description` (or `Name`), `Amount`, `Type`
- Optional columns: `Category`, `Notes and #tags`
- Date format: DD/MM/YYYY

#### Amex (CSV or Excel)
- Required columns: `Date`, `Description`, `Amount`, `Account #`
- Date format: DD/MM/YYYY

### Mapping Files

#### merchant_mapping.csv
```csv
raw_merchant,standardized_merchant
AMAZON.CO.UK,Amazon
TESCO STORE 1234,Tesco
SAINSBURYS S-MKTS,Sainsbury's
```

#### category_mapping.csv
```csv
merchant,category
Amazon,Shopping
Tesco,Groceries
Uber,Transport
```

## Project Structure

```
├── app.py              # Main Streamlit application
├── parser.py           # Transaction file parsers
├── deduplicator.py     # Merchant name deduplication
├── classifier.py       # AI-powered categorization
├── analyzer.py         # Spending analysis and reporting
├── requirements.txt    # Python dependencies
├── .env               # Environment variables (create this)
└── README.md          # This file
```

## Categories

The system uses these standard categories:

- **Groceries**: Supermarkets, food shopping
- **Eating out**: Restaurants, cafes, takeaways
- **Transport**: TfL, Uber, trains, petrol
- **Shopping**: Retail, online shopping
- **Entertainment**: Streaming, events, subscriptions
- **Income**: Salary, refunds, payments received
- **Bills**: Utilities, phone, insurance
- **Holidays**: Travel, hotels, flights
- **Fitness**: Gyms, sports clubs
- **Personal care**: Pharmacy, beauty, healthcare
- **General**: Miscellaneous items
- **Transfers**: Internal transfers (auto-detected and excluded from analysis)
- **Uncategorized**: Items not yet categorized

## Tips

1. **Save your mappings**: Always download and save the mapping files at the end. They make future months much faster!

2. **Use Excel files**: If you have both CSV and Excel options, Excel files often work better as they preserve formatting and can contain multiple months in different sheets.

3. **Filter by date**: Use the date range filter to analyze specific months. This is perfect for monthly budget reviews!

4. **Review AI suggestions**: The AI is pretty good but check its category assignments, especially for ambiguous merchants.

5. **Standardize merchants consistently**: When deduplicating, choose a consistent naming style (e.g., always "Sainsbury's" not "Sainsburys").

6. **Upload all accounts**: For best results, upload transactions from all your active accounts to get a complete picture.

7. **Monthly analysis**: Run this monthly for best tracking. The mapping files build up knowledge over time.

## Troubleshooting

### "No transactions found"
- Check your CSV files have the required columns
- Verify the date format matches expected format (DD/MM/YYYY)

### "AI classification failed"
- Check your OpenAI API key is correct
- Ensure you have API credits available
- You can still categorize manually even if AI fails

### "Missing required fields"
- Make sure your CSV exports include Date, Description/Name, and Amount columns

## Privacy & Security

- All processing happens locally on your machine
- Transaction data is never sent anywhere except OpenAI for categorization (only merchant names, not amounts or full details)
- No data is stored permanently - everything is session-based
- Your API key is stored in .env (make sure to keep this file secure and never commit it to version control)

## License

This is a personal finance tool for individual use.
