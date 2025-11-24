"""
Transaction parser for Monzo and Amex CSV files.
"""
import pandas as pd
from datetime import datetime
from io import StringIO


class TransactionParser:
    """Parse and standardize transaction files from different banks."""

    def __init__(self):
        self.account_names = {
            'deane_monzo': 'Deane Monzo',
            'thea_monzo': 'Thea Monzo',
            'joint_monzo': 'Joint Monzo',
            'gold_amex': 'Gold Amex',
            'ba_amex': 'BA Amex'
        }

    def parse_monzo_csv(self, file_content, account_name):
        """Parse Monzo CSV format."""
        df = pd.read_csv(StringIO(file_content.decode('utf-8')))

        transactions = []
        for _, row in df.iterrows():
            # Skip if essential fields are missing
            if pd.isna(row.get('Date')) or pd.isna(row.get('Amount')):
                continue

            transactions.append({
                'date': pd.to_datetime(row['Date'], format='%d/%m/%Y'),
                'description': str(row.get('Description', row.get('Name', ''))),
                'amount': float(row['Amount']),
                'category': row.get('Category') if pd.notna(row.get('Category')) else None,
                'account': account_name,
                'transaction_type': str(row.get('Type', 'Unknown')),
            })

        return transactions

    def parse_amex_csv(self, file_content, account_name):
        """Parse Amex CSV format."""
        df = pd.read_csv(StringIO(file_content.decode('utf-8')))

        transactions = []
        for _, row in df.iterrows():
            # Skip if essential fields are missing
            if pd.isna(row.get('Date')) or pd.isna(row.get('Amount')):
                continue

            description = str(row.get('Description', ''))
            is_payment = 'PAYMENT RECEIVED' in description.upper()

            # Amex shows debits as positive, so we negate to match Monzo format
            amount = -float(row['Amount'])

            transactions.append({
                'date': pd.to_datetime(row['Date'], format='%d/%m/%Y'),
                'description': description,
                'amount': amount,
                'category': None,  # Amex doesn't provide categories
                'account': account_name,
                'transaction_type': 'Payment' if is_payment else 'Card payment',
            })

        return transactions

    def load_all_transactions(self, files_dict):
        """
        Load transactions from multiple files.

        Args:
            files_dict: Dictionary mapping account keys to file contents
                       e.g., {'deane_monzo': file_content, 'gold_amex': file_content}

        Returns:
            DataFrame with all standardized transactions
        """
        all_transactions = []

        for account_key, file_content in files_dict.items():
            if file_content is None:
                continue

            account_name = self.account_names[account_key]

            # Determine parser based on account type
            if 'monzo' in account_key:
                transactions = self.parse_monzo_csv(file_content, account_name)
            elif 'amex' in account_key:
                transactions = self.parse_amex_csv(file_content, account_name)
            else:
                continue

            all_transactions.extend(transactions)

        if not all_transactions:
            return pd.DataFrame()

        df = pd.DataFrame(all_transactions)
        df = df.sort_values('date').reset_index(drop=True)

        return df

    def identify_internal_transfers(self, df):
        """
        Identify and flag internal transfers between accounts.
        Returns DataFrame with 'is_internal_transfer' column added.
        """
        df['is_internal_transfer'] = False

        # Keywords that indicate internal transfers
        transfer_keywords = [
            'MONZO-TO-MONZO',
            'THEADORA MATHIAS & DEANE BARTON',
            'DEANE BARTON',
            'REVOLUT',
            'AMERICAN EXPRESS',
            'AMEX'
        ]

        # Mark potential transfers
        potential_transfers = df[
            df['description'].str.upper().str.contains('|'.join(transfer_keywords), na=False)
        ].copy()

        # Try to match transfers (same amount, opposite signs, within 2 days)
        for idx1, row1 in potential_transfers.iterrows():
            if df.loc[idx1, 'is_internal_transfer']:
                continue

            for idx2, row2 in potential_transfers.iterrows():
                if idx1 >= idx2 or df.loc[idx2, 'is_internal_transfer']:
                    continue

                # Check if amounts cancel out
                if abs(row1['amount'] + row2['amount']) < 0.01:
                    # Check if dates are within 2 days
                    if abs((row1['date'] - row2['date']).days) <= 2:
                        df.loc[idx1, 'is_internal_transfer'] = True
                        df.loc[idx2, 'is_internal_transfer'] = True

        return df
