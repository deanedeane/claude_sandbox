"""
AI-powered transaction categorization using OpenAI.
"""
import pandas as pd
import json
import re
from io import StringIO
from openai import OpenAI


class TransactionClassifier:
    """Classify transactions into categories using AI."""

    # Standard categories
    STANDARD_CATEGORIES = [
        'Groceries',
        'Eating out',
        'Transport',
        'Shopping',
        'Entertainment',
        'Income',
        'Bills',
        'Holidays',
        'Fitness',
        'Personal care',
        'General',
        'Transfers',
        'Uncategorized'
    ]

    def __init__(self, api_key, existing_mapping=None):
        """
        Initialize classifier.

        Args:
            api_key: OpenAI API key
            existing_mapping: DataFrame with 'merchant' and 'category' columns
        """
        self.client = OpenAI(api_key=api_key)
        self.mapping = {}

        if existing_mapping is not None and not existing_mapping.empty:
            for _, row in existing_mapping.iterrows():
                self.mapping[row['merchant']] = row['category']

    def classify_merchants(self, merchants, batch_size=30):
        """
        Classify a list of merchants using OpenAI.

        Args:
            merchants: List of dicts with 'merchant' and 'raw_description' keys,
                      OR list of merchant name strings (for backward compatibility)
            batch_size: Number of merchants to classify per API call

        Returns:
            Dictionary mapping merchant name to category
        """
        results = {}

        # Normalize input format
        if merchants and isinstance(merchants[0], dict):
            # New format with raw descriptions
            merchant_data = merchants
        else:
            # Old format - just merchant names
            merchant_data = [{'merchant': m, 'raw_description': m} for m in merchants]

        # Filter out merchants already in mapping
        to_classify = [m for m in merchant_data if m['merchant'] not in self.mapping]

        if not to_classify:
            return self.mapping.copy()

        # Process in batches
        for i in range(0, len(to_classify), batch_size):
            batch = to_classify[i:i + batch_size]
            batch_results = self._classify_batch(batch)
            results.update(batch_results)

        # Combine with existing mapping
        results.update(self.mapping)
        return results

    def _classify_batch(self, merchants):
        """Classify a batch of merchants."""
        # Create numbered list for the prompt with both standardized and raw descriptions
        merchant_list = "\n".join([
            f"{i}: {m['merchant']} (raw: {m['raw_description']})"
            for i, m in enumerate(merchants)
        ])

        prompt = f"""Classify these merchants/transactions into spending categories.
For each merchant, you're given both the standardized name and the raw transaction description.
Use both to determine the best category.

Available categories:
{', '.join(self.STANDARD_CATEGORIES)}

Category guidelines:
- Groceries: Supermarkets, food shops (Tesco, Sainsbury's, Waitrose, M&S Food, Ocado, etc.)
- Eating out: Restaurants, cafes, pubs, takeaways
- Transport: TfL, Uber, trains, buses, petrol stations, car services
- Shopping: Retail stores, online shopping (excluding groceries)
- Entertainment: Cinema, streaming services (Netflix, Spotify), events, games
- Income: Salary payments, refunds, cashback, "Payment Received"
- Bills: Utilities, phone, internet, insurance, council tax
- Holidays: Hotels, flights, travel booking sites, holiday expenses
- Fitness: Gyms, sports clubs, fitness classes, sports equipment
- Personal care: Pharmacy, beauty, haircuts, healthcare
- General: Items that don't fit other categories
- Transfers: Internal transfers, moving money between accounts

Merchants to classify:
{merchant_list}

Respond with ONLY a JSON object mapping the number to category. Example format:
{{"0": "Groceries", "1": "Transport", "2": "Eating out"}}"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a financial transaction categorization assistant. Respond only with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )

            response_text = response.choices[0].message.content

            # Parse JSON from response
            classification = self._parse_json_response(response_text)

            # Map back to merchant names
            results = {}
            for idx_str, category in classification.items():
                idx = int(idx_str)
                if idx < len(merchants):
                    results[merchants[idx]['merchant']] = category

            return results

        except Exception as e:
            print(f"Error classifying batch: {e}")
            # Return default categories for failed batch
            return {m['merchant']: 'Uncategorized' for m in merchants}

    def _parse_json_response(self, response_text):
        """Extract and parse JSON from response text."""
        # Try to find JSON in code blocks first
        match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if match:
            json_str = match.group(1).strip()
        else:
            # Try to find any JSON object
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if match:
                json_str = match.group(0).strip()
            else:
                raise ValueError("No JSON found in response")

        return json.loads(json_str)

    def build_mapping_dataframe(self, df):
        """
        Build category mapping DataFrame from transactions.

        Args:
            df: DataFrame with 'merchant' column

        Returns:
            DataFrame with 'merchant' and 'category' columns
        """
        unique_merchants = sorted(df['merchant'].unique())

        mapping_data = []
        for merchant in unique_merchants:
            category = self.mapping.get(merchant, None)
            mapping_data.append({
                'merchant': merchant,
                'category': category if category else ''
            })

        return pd.DataFrame(mapping_data)

    def apply_categories(self, df, category_mapping_df):
        """
        Apply category mapping to transactions.

        Args:
            df: Transaction DataFrame with 'merchant' column
            category_mapping_df: DataFrame with 'merchant' and 'category' columns

        Returns:
            DataFrame with 'category' column updated
        """
        # Build mapping dict
        mapping_dict = {}
        for _, row in category_mapping_df.iterrows():
            if pd.notna(row['category']) and row['category']:
                mapping_dict[row['merchant']] = row['category']

        # Apply mapping
        for merchant, category in mapping_dict.items():
            df.loc[df['merchant'] == merchant, 'category'] = category

        # Fill any remaining with 'Uncategorized'
        df['category'] = df['category'].fillna('Uncategorized')

        return df

    @staticmethod
    def load_mapping_from_csv(file_content):
        """Load category mapping from CSV file."""
        return pd.read_csv(StringIO(file_content.decode('utf-8')))

    @staticmethod
    def export_mapping_to_csv(mapping_df):
        """Export mapping DataFrame to CSV string."""
        return mapping_df.to_csv(index=False)
