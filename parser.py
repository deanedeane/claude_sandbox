"""
Transaction parser for Monzo and Amex CSV and Excel files.
"""
import pandas as pd
from datetime import datetime
from io import StringIO, BytesIO


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

            raw_desc = str(row.get('Description', row.get('Name', '')))
            trans_type = str(row.get('Type', 'Unknown'))

            # Identify bank transfers
            is_bank_transfer = 'transfer' in trans_type.lower() or trans_type.lower() in ['bank transfer', 'transfer']

            transactions.append({
                'date': pd.to_datetime(row['Date'], format='%d/%m/%Y'),
                'raw_description': raw_desc,
                'description': raw_desc,  # Will become standardized merchant name later
                'amount': float(row['Amount']),
                'category': row.get('Category') if pd.notna(row.get('Category')) else None,
                'account': account_name,
                'transaction_type': trans_type,
                'is_bank_transfer': is_bank_transfer,
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
                'raw_description': description,
                'description': description,  # Will become standardized merchant name later
                'amount': amount,
                'category': None,  # Amex doesn't provide categories
                'account': account_name,
                'transaction_type': 'Payment' if is_payment else 'Card payment',
                'is_bank_transfer': is_payment,  # Payments are bank transfers for Amex
            })

        return transactions

    def get_excel_sheets(self, file_content):
        """
        Get list of sheet names from an Excel file.

        Args:
            file_content: Bytes content of Excel file

        Returns:
            List of sheet names
        """
        excel_file = pd.ExcelFile(BytesIO(file_content))
        return excel_file.sheet_names

    def parse_excel(self, file_content, account_name, sheet_name=None):
        """
        Parse Excel file (XLS or XLSX) format.

        Args:
            file_content: Bytes content of Excel file
            account_name: Name of the account
            sheet_name: Specific sheet to read (if None, reads first sheet)

        Returns:
            List of transaction dictionaries
        """
        if sheet_name:
            df = pd.read_excel(BytesIO(file_content), sheet_name=sheet_name)
        else:
            df = pd.read_excel(BytesIO(file_content))

        # Determine if this is Monzo or Amex format based on columns
        is_amex = 'Card Member' in df.columns or 'Account #' in df.columns

        if is_amex:
            return self._parse_amex_format(df, account_name)
        else:
            return self._parse_monzo_format(df, account_name)

    def _parse_monzo_format(self, df, account_name):
        """Parse DataFrame in Monzo format."""
        transactions = []
        for _, row in df.iterrows():
            # Skip if essential fields are missing
            if pd.isna(row.get('Date')) or pd.isna(row.get('Amount')):
                continue

            raw_desc = str(row.get('Description', row.get('Name', '')))
            trans_type = str(row.get('Type', 'Unknown'))

            # Identify bank transfers
            is_bank_transfer = 'transfer' in trans_type.lower() or trans_type.lower() in ['bank transfer', 'transfer']

            transactions.append({
                'date': pd.to_datetime(row['Date'], format='%d/%m/%Y'),
                'raw_description': raw_desc,
                'description': raw_desc,  # Will become standardized merchant name later
                'amount': float(row['Amount']),
                'category': row.get('Category') if pd.notna(row.get('Category')) else None,
                'account': account_name,
                'transaction_type': trans_type,
                'is_bank_transfer': is_bank_transfer,
            })

        return transactions

    def _parse_amex_format(self, df, account_name):
        """Parse DataFrame in Amex format."""
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
                'raw_description': description,
                'description': description,  # Will become standardized merchant name later
                'amount': amount,
                'category': None,  # Amex doesn't provide categories
                'account': account_name,
                'transaction_type': 'Payment' if is_payment else 'Card payment',
                'is_bank_transfer': is_payment,  # Payments are bank transfers for Amex
            })

        return transactions

    def load_all_transactions(self, files_dict):
        """
        Load transactions from multiple files.

        Args:
            files_dict: Dictionary mapping account keys to tuples of (file_content, file_type, sheet_name)
                       e.g., {'deane_monzo': (content, 'csv', None), 'gold_amex': (content, 'xlsx', 'Sheet1')}
                       file_type can be 'csv', 'xlsx', or 'xls'
                       sheet_name is optional for Excel files

        Returns:
            DataFrame with all standardized transactions
        """
        all_transactions = []

        for account_key, file_info in files_dict.items():
            if file_info is None:
                continue

            file_content, file_type, sheet_name = file_info
            account_name = self.account_names[account_key]

            # Parse based on file type
            if file_type == 'csv':
                # Determine parser based on account type for CSV
                if 'monzo' in account_key:
                    transactions = self.parse_monzo_csv(file_content, account_name)
                elif 'amex' in account_key:
                    transactions = self.parse_amex_csv(file_content, account_name)
                else:
                    continue
            elif file_type in ['xlsx', 'xls']:
                # Use Excel parser
                transactions = self.parse_excel(file_content, account_name, sheet_name)
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
