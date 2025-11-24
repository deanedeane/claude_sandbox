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
        cleaned = merchant_name.strip()

        # Common patterns to clean up
        # Remove common prefixes/suffixes
        cleaned = re.sub(r'^(WWW\.|HTTP://|HTTPS://)', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\.(COM|CO\.UK|NET|ORG)$', '', cleaned, flags=re.IGNORECASE)

        # Remove location codes and numbers at the end
        cleaned = re.sub(r'\s+\d+$', '', cleaned)
        cleaned = re.sub(r'\s+[A-Z]{2,3}\d+$', '', cleaned)

        # Title case for readability
        cleaned = cleaned.title()

        # Specific known merchants
        if 'AMAZON' in cleaned.upper():
            cleaned = 'Amazon'
        elif 'TESCO' in cleaned.upper():
            cleaned = 'Tesco'
        elif 'SAINSBURY' in cleaned.upper():
            cleaned = "Sainsbury's"
        elif 'WAITROSE' in cleaned.upper():
            cleaned = 'Waitrose'
        elif 'MARKS & SPENCER' in cleaned.upper() or 'M&S' in cleaned.upper():
            cleaned = 'M&S'
        elif 'OCADO' in cleaned.upper():
            cleaned = 'Ocado'
        elif 'TFL' in cleaned.upper() or 'TRANSPORT FOR LONDON' in cleaned.upper():
            cleaned = 'TfL'
        elif 'UBER' in cleaned.upper():
            cleaned = 'Uber'
        elif 'PAYMENT RECEIVED' in cleaned.upper():
            cleaned = 'Payment Received'
        elif 'PAYPAL' in cleaned.upper():
            cleaned = 'PayPal'
        elif 'NETFLIX' in cleaned.upper():
            cleaned = 'Netflix'
        elif 'SPOTIFY' in cleaned.upper():
            cleaned = 'Spotify'
        elif 'APPLE.COM' in cleaned.upper() or 'APPLE INC' in cleaned.upper():
            cleaned = 'Apple'

        return cleaned

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
