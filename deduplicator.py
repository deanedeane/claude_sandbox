"""
Merchant name deduplication and standardization.
"""
import pandas as pd
import re
from io import StringIO


class MerchantDeduplicator:
    """Handle merchant name deduplication and standardization."""

    def __init__(self, existing_mapping=None):
        """
        Initialize with optional existing mapping.

        Args:
            existing_mapping: DataFrame with 'raw_merchant' and 'standardized_merchant' columns
        """
        self.mapping = {}
        if existing_mapping is not None and not existing_mapping.empty:
            for _, row in existing_mapping.iterrows():
                self.mapping[row['raw_merchant']] = row['standardized_merchant']

    def extract_unique_merchants(self, df):
        """
        Extract unique merchant names from transactions.

        Args:
            df: DataFrame with 'description' column

        Returns:
            List of unique merchant names
        """
        # Get unique descriptions (raw merchant names)
        unique = df['description'].dropna().unique().tolist()
        return sorted(unique)

    def auto_standardize(self, merchant_name):
        """
        Auto-standardize a merchant name using heuristics.

        Args:
            merchant_name: Raw merchant name

        Returns:
            Standardized merchant name
        """
        # Check if already in mapping
        if merchant_name in self.mapping:
            return self.mapping[merchant_name]

        # Handle empty/null values
        if pd.isna(merchant_name) or str(merchant_name).strip() == '' or str(merchant_name).lower() == 'nan':
            return 'Unknown'

        original = merchant_name
        cleaned = str(merchant_name).strip().upper()

        # Handle pure numeric or mostly numeric entries
        if re.match(r'^[\d\s\*\-]+$', cleaned):
            return 'Transaction ID'

        # Handle salary patterns FIRST (before other processing)
        if re.search(r'\bSALARY\b', cleaned, re.IGNORECASE):
            return 'Salary'

        # Payment processor prefixes - extract actual merchant name
        # Square (SQ *)
        if cleaned.startswith('SQ *'):
            cleaned = cleaned.replace('SQ *', '', 1).strip()
        # Shop Pay (SP)
        elif cleaned.startswith('SP '):
            cleaned = cleaned.replace('SP ', '', 1).strip()
        # Zettle
        elif cleaned.startswith('ZETTLE *') or cleaned.startswith('ZETTLE_*'):
            cleaned = re.sub(r'^ZETTLE[\s_]\*', '', cleaned).strip()
        # SumUp
        elif cleaned.startswith('SUMUP*') or cleaned.startswith('SUMUP '):
            cleaned = re.sub(r'^SUMUP[\s\*]+', '', cleaned).strip()
        # Dojo
        elif cleaned.startswith('DOJO*'):
            cleaned = cleaned.replace('DOJO*', '', 1).strip()
        # TST
        elif cleaned.startswith('TST*') or cleaned.startswith('TST-'):
            cleaned = re.sub(r'^TST[\*\-]', '', cleaned).strip()
        # UBR (Uber variants)
        elif cleaned.startswith('UBR'):
            cleaned = 'UBER'
        # CLR
        elif cleaned.startswith('CLR*'):
            cleaned = cleaned.replace('CLR*', '', 1).strip()
        # NYX
        elif cleaned.startswith('NYX*'):
            cleaned = cleaned.replace('NYX*', '', 1).strip()
        # PYD
        elif cleaned.startswith('PYD*'):
            cleaned = cleaned.replace('PYD*', '', 1).strip()
        # TXW
        elif cleaned.startswith('TXW*'):
            cleaned = cleaned.replace('TXW*', '', 1).strip()
        # VMS
        elif cleaned.startswith('VMS '):
            cleaned = cleaned.replace('VMS ', '', 1).strip()

        # Remove country codes (GBR, USA, MEX, IRL, etc.) - must be at word boundary
        cleaned = re.sub(r'\s+(GBR|USA|MEX|IRL|CAN|AUS|EUR|NZL|GER|FRA|ESP|ITA|DNK|NLD)(\s+GBR)?$', '', cleaned, flags=re.IGNORECASE)

        # Remove city/location codes
        cleaned = re.sub(r'\s+(LONDON|NEW YORK|MANCHESTER|BIRMINGHAM|EDINBURGH|GLASGOW|DUBLIN|BRISBANE|SAN FRANCISCO|LOS ANGELES|CARSON|SANTA MONICA|SAN DIEGO|OAXACA DE JUA|CIUDAD DE MEX|PARIS)\s*', ' ', cleaned, flags=re.IGNORECASE)

        # Remove phone numbers (+44xxx, etc.)
        cleaned = re.sub(r'\+?\d{10,15}', '', cleaned)

        # Remove reference numbers and transaction IDs (6+ digits)
        cleaned = re.sub(r'\b\d{6,}\b', '', cleaned)

        # Remove date patterns (DDMMYY, etc.)
        cleaned = re.sub(r'\d{2}[A-Z]{3}\d{2}', '', cleaned)

        # Remove WWW and domain extensions
        cleaned = re.sub(r'^(WWW\.|HTTP://|HTTPS://)', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\.(COM|CO\.UK|NET|ORG|IE|FR)(\s|$)', ' ', cleaned, flags=re.IGNORECASE)

        # Remove Google temporary hold patterns
        cleaned = re.sub(r'\s*\*?(CHROME|GPAY|YOUTUBE)\s+TEMP(ORARY)?\s+(HOLD)?\s*', ' GOOGLE ', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'GOOGLE\s+\*', 'GOOGLE ', cleaned, flags=re.IGNORECASE)

        # Remove card types and payment indicators
        cleaned = re.sub(r'\s+(VISA|MASTERCARD|AMEX(?!$)|PAYMENT|PURCHASE|POS)\s*', ' ', cleaned, flags=re.IGNORECASE)

        # Remove store/branch numbers (must come BEFORE address removal)
        cleaned = re.sub(r'\s+\d{3,5}(TE)?\s*$', '', cleaned)  # Trailing store numbers like "3474" or "3474TE"
        cleaned = re.sub(r'\s+(STORE|BRANCH|UNIT|#|ST)\s*\d+', '', cleaned, flags=re.IGNORECASE)

        # Remove address/location patterns
        cleaned = re.sub(r'\s+\d+\s+[A-Z\s]+(ROAD|STREET|RD|ST|AVENUE|AVE)\b', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*\\[^\\]+\\', ' ', cleaned)  # Remove backslash-separated data

        # Remove postcodes (EC1 2NZ, SW1A 1AA, SW11, etc.)
        cleaned = re.sub(r'\s+[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d?[A-Z]{0,2}$', '', cleaned)
        cleaned = re.sub(r'\s+SW\d+(\s+\d[A-Z]{2})?', '', cleaned)

        # Remove common suffixes
        cleaned = re.sub(r'\s+(LTD|LIMITED|INC|LLC|PLC|PTY)(\s|$)', ' ', cleaned, flags=re.IGNORECASE)

        # Remove help URLs and reference text
        cleaned = re.sub(r'(HELP\.UBER\.COM|HTTPS?://[^\s]+|CC@GOOGLE\.COM|AMAZON\.CO\.UK|AMZN\.CO\.UK)', '', cleaned, flags=re.IGNORECASE)

        # Clean up extra spaces and special characters
        cleaned = ' '.join(cleaned.split())
        cleaned = cleaned.strip()

        # If we're left with nothing or just punctuation, return original cleaned
        if not cleaned or re.match(r'^[\W_]+$', cleaned):
            # Try to extract something meaningful from original
            words = re.findall(r'[A-Z][a-z]+', original)
            if words:
                return ' '.join(words[:2])  # Take first 2 title-case words
            return 'Unknown Transaction'

        upper = cleaned.upper()

        # PRIORITY CHECKS - Most specific first (to avoid false matches)

        # Salaries/Income (check first)
        if 'SALARY' in upper or re.match(r'^\d+/\d+$', cleaned):
            return 'Salary'
        if 'PAYMENT RECEIVED' in upper or 'PAYMENT THANK' in upper or 'THANK YOU' in upper:
            return 'Payment Received'

        # Streaming/Subscriptions (check before other services)
        if 'NETFLIX' in upper:
            return 'Netflix'
        elif 'SPOTIFY' in upper:
            return 'Spotify'
        elif 'YOUTUBE' in upper or 'YOUTUBEPREMIUM' in upper:
            return 'YouTube'
        elif 'HAYU' in upper:
            return 'Hayu'
        elif 'NOW ' in upper and 'ENTERTAIN' in upper:
            return 'NOW TV'

        # Tech companies
        elif 'GOOGLE' in upper or 'G.CO' in upper or 'GSUITE' in upper:
            if 'ONE' in upper:
                return 'Google One'
            return 'Google'
        elif 'APPLE' in upper:
            return 'Apple'
        elif 'PAYPAL' in upper:
            return 'PayPal'

        # Amazon (check before other retailers)
        elif 'AMAZON' in upper or 'AMZN' in upper:
            if 'PRIME' in upper:
                return 'Amazon Prime'
            return 'Amazon'

        # Major UK supermarkets
        elif 'TESCO' in upper:
            return 'Tesco'
        elif 'SAINSBURY' in upper:
            return "Sainsbury's"
        elif 'WAITROSE' in upper:
            return 'Waitrose'
        elif ('MARKS' in upper and 'SPENCER' in upper) or upper in ['M&S', 'M & S', 'M&S CLAPHAM']:
            return 'M&S'
        elif 'OCADO' in upper:
            return 'Ocado'
        elif 'ASDA' in upper:
            return 'Asda'
        elif 'ALDI' in upper:
            return 'Aldi'
        elif 'LIDL' in upper:
            return 'Lidl'
        elif 'MORRISONS' in upper:
            return 'Morrisons'
        elif 'CO-OP' in upper or upper == 'COOP' or 'CO OP' in upper:
            return 'Co-op'

        # Transport (check TFL carefully - must be exact or at start/end)
        elif upper == 'TFL' or upper.startswith('TFL ') or ' TFL' in upper or 'TFL TRAVEL' in upper or 'TRANSPORT FOR LONDON' in upper:
            return 'TfL'
        elif 'UBER' in upper:
            return 'Uber'
        elif 'TRAINLINE' in upper:
            return 'Trainline'
        elif 'EUROSTAR' in upper:
            return 'Eurostar'
        elif 'AVANTI' in upper:
            return 'Avanti West Coast'

        # Coffee/Food chains
        elif 'STARBUCKS' in upper:
            return 'Starbucks'
        elif 'COSTA' in upper and 'COFFEE' in upper:
            return 'Costa Coffee'
        elif 'PRET' in upper:
            return 'Pret'
        elif 'GREGGS' in upper:
            return 'Greggs'
        elif 'GAILS' in upper:
            return 'Gails'
        elif 'GETT' in upper:
            return 'Gett'
        elif 'FORZA' in upper:
            return 'Forza'
        elif 'CAFFE NERO' in upper:
            return 'Caffe Nero'

        # Delivery services
        elif 'DELIVEROO' in upper:
            return 'Deliveroo'
        elif 'JUST EAT' in upper or 'JUSTEAT' in upper:
            return 'Just Eat'

        # Other merchants
        elif 'REVOLUT' in upper:
            return 'Revolut'
        elif 'MONZO' in upper:
            return 'Monzo'

        # If no specific match, clean up remaining junk and title case
        cleaned = re.sub(r'[^\w\s\-&\'\(\)]', ' ', cleaned)
        cleaned = re.sub(r'\s+\d+\s*$', '', cleaned)  # Remove trailing numbers
        cleaned = ' '.join(cleaned.split())
        cleaned = cleaned.strip()

        # Return cleaned and title-cased
        if cleaned:
            return cleaned.title()

        return 'Unknown Transaction'

    def build_mapping_dataframe(self, unique_merchants):
        """
        Build a mapping DataFrame for user review/editing.

        Args:
            unique_merchants: List of unique merchant names

        Returns:
            DataFrame with 'raw_merchant' and 'standardized_merchant' columns
        """
        mapping_data = []
        for merchant in unique_merchants:
            standardized = self.auto_standardize(merchant)
            mapping_data.append({
                'raw_merchant': merchant,
                'standardized_merchant': standardized
            })

        return pd.DataFrame(mapping_data)

    def apply_mapping(self, df, mapping_df):
        """
        Apply merchant standardization to transaction DataFrame.

        Args:
            df: Transaction DataFrame with 'description' column
            mapping_df: Mapping DataFrame with 'raw_merchant' and 'standardized_merchant' columns

        Returns:
            DataFrame with new 'merchant' column containing standardized names
        """
        # Build mapping dict
        mapping_dict = {}
        for _, row in mapping_df.iterrows():
            mapping_dict[row['raw_merchant']] = row['standardized_merchant']

        # Apply mapping
        df['merchant'] = df['description'].map(mapping_dict)

        # Fill any missing with original description
        df['merchant'] = df['merchant'].fillna(df['description'])

        return df

    @staticmethod
    def load_mapping_from_csv(file_content):
        """
        Load merchant mapping from CSV file.

        Args:
            file_content: Bytes content of CSV file

        Returns:
            DataFrame with mapping
        """
        return pd.read_csv(StringIO(file_content.decode('utf-8')))

    @staticmethod
    def export_mapping_to_csv(mapping_df):
        """
        Export mapping DataFrame to CSV string.

        Args:
            mapping_df: DataFrame with mapping

        Returns:
            CSV string
        """
        return mapping_df.to_csv(index=False)
