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

        # Basic cleaning
        cleaned = merchant_name.strip().upper()

        # Remove common card processing codes and metadata
        # Remove country codes (GBR, USA, MEX, IRL, etc.)
        cleaned = re.sub(r'\s+(GBR|USA|MEX|IRL|CAN|AUS|EUR|NZL|GER|FRA|ESP|ITA)\s*$', '', cleaned, flags=re.IGNORECASE)

        # Remove city/location codes at end (LONDON, NEW YORK, etc.)
        cleaned = re.sub(r'\s+(LONDON|NEW YORK|MANCHESTER|BIRMINGHAM|EDINBURGH|GLASGOW)\s*', ' ', cleaned, flags=re.IGNORECASE)

        # Remove phone numbers (+44xxx, etc.)
        cleaned = re.sub(r'\+?\d{10,15}', '', cleaned)

        # Remove reference numbers and transaction IDs
        cleaned = re.sub(r'\s+\d{6,}', '', cleaned)

        # Remove date patterns (DDMMYY, etc.)
        cleaned = re.sub(r'\d{2}[A-Z]{3}\d{2}', '', cleaned)

        # Remove common prefixes
        cleaned = re.sub(r'^(WWW\.|HTTP://|HTTPS://)', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\.(COM|CO\.UK|NET|ORG)(\s|$)', ' ', cleaned, flags=re.IGNORECASE)

        # Remove Google temporary hold patterns
        cleaned = re.sub(r'\s*\*?(CHROME|GPAY|YOUTUBE)\s+TEMP(ORARY)?\s+(HOLD)?\s*', ' GOOGLE ', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'GOOGLE\s+\*', 'GOOGLE ', cleaned, flags=re.IGNORECASE)

        # Remove card types and payment indicators
        cleaned = re.sub(r'\s+(VISA|MASTERCARD|AMEX|PAYMENT|PURCHASE|POS)\s*', ' ', cleaned, flags=re.IGNORECASE)

        # Remove address components
        cleaned = re.sub(r'\s+\d+\s+[A-Z\s]+ROAD', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s+\d+\s+[A-Z\s]+STREET', '', cleaned, flags=re.IGNORECASE)

        # Remove postcode patterns (EC1 2NZ, SW1A 1AA, etc.)
        cleaned = re.sub(r'\s+[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}', '', cleaned)

        # Remove store numbers and branch codes (STORE 1234, #123, etc.)
        cleaned = re.sub(r'\s+(STORE|BRANCH|UNIT|#)\s*\d+', '', cleaned, flags=re.IGNORECASE)

        # Clean up extra spaces
        cleaned = ' '.join(cleaned.split())
        cleaned = cleaned.strip()

        # Specific known merchants - expanded list
        upper = cleaned.upper()

        # Major retailers
        if 'AMAZON' in upper:
            return 'Amazon'
        elif 'TESCO' in upper:
            return 'Tesco'
        elif 'SAINSBURY' in upper:
            return "Sainsbury's"
        elif 'WAITROSE' in upper:
            return 'Waitrose'
        elif 'MARKS & SPENCER' in upper or 'M&S' in upper or 'M & S' in upper:
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
        elif 'CO-OP' in upper or 'COOP' in upper or 'CO OP' in upper:
            return 'Co-op'

        # Transport
        elif 'TFL' in upper or 'TRANSPORT FOR LONDON' in upper:
            return 'TfL'
        elif 'UBER' in upper:
            return 'Uber'
        elif 'TRAINLINE' in upper:
            return 'Trainline'
        elif 'CITYMAPPER' in upper:
            return 'Citymapper'

        # Tech/Services
        elif 'GOOGLE' in upper or 'G.CO' in upper:
            # Handle specific Google services
            if 'YOUTUBE' in upper:
                return 'YouTube'
            else:
                return 'Google'
        elif 'APPLE' in upper:
            return 'Apple'
        elif 'SPOTIFY' in upper:
            return 'Spotify'
        elif 'NETFLIX' in upper:
            return 'Netflix'
        elif 'AMAZON PRIME' in upper:
            return 'Amazon Prime'
        elif 'PAYPAL' in upper:
            return 'PayPal'

        # Coffee/Food chains
        elif 'STARBUCKS' in upper:
            return 'Starbucks'
        elif 'COSTA' in upper and 'COFFEE' in upper:
            return 'Costa Coffee'
        elif 'PRET' in upper or 'PRET A MANGER' in upper:
            return 'Pret'
        elif 'GREGGS' in upper:
            return 'Greggs'
        elif 'GAILS' in upper:
            return 'Gails'
        elif 'GETT' in upper:
            return 'Gett'
        elif 'FORZA' in upper:
            return 'Forza'

        # Gyms/Fitness
        elif 'PUREGYM' in upper or 'PURE GYM' in upper:
            return 'PureGym'
        elif 'GYMBOX' in upper:
            return 'Gymbox'

        # Utilities/Bills
        elif 'PAYMENT RECEIVED' in upper or 'PAYMENT THANK YOU' in upper:
            return 'Payment Received'
        elif 'BRITISH GAS' in upper:
            return 'British Gas'
        elif 'THAMES WATER' in upper:
            return 'Thames Water'

        # If no specific match, clean up and title case
        # Remove remaining special characters but keep basic ones
        cleaned = re.sub(r'[^\w\s\-&\']', ' ', cleaned)
        cleaned = ' '.join(cleaned.split())

        # Title case
        return cleaned.title()

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
