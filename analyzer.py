"""
Transaction analysis and reporting.
"""
import pandas as pd


class SpendingAnalyzer:
    """Analyze spending patterns from transactions."""

    def __init__(self, df):
        """
        Initialize analyzer with transaction DataFrame.

        Args:
            df: DataFrame with transactions (must have 'merchant', 'category', 'amount', 'account' columns)
        """
        self.df = df.copy()

    def get_analysis_data(self):
        """
        Filter data for analysis (exclude internal transfers).

        Returns:
            Filtered DataFrame
        """
        # Exclude internal transfers
        return self.df[~self.df['is_internal_transfer']].copy()

    def get_summary_stats(self):
        """
        Calculate overall summary statistics.

        Returns:
            Dictionary with summary stats
        """
        analysis_df = self.get_analysis_data()

        total_inflows = analysis_df[analysis_df['amount'] > 0]['amount'].sum()
        total_outflows = abs(analysis_df[analysis_df['amount'] < 0]['amount'].sum())
        net_cashflow = analysis_df['amount'].sum()

        date_range = (
            analysis_df['date'].min().strftime('%d %b %Y'),
            analysis_df['date'].max().strftime('%d %b %Y')
        )

        return {
            'total_inflows': total_inflows,
            'total_outflows': total_outflows,
            'net_cashflow': net_cashflow,
            'date_range': date_range,
            'transaction_count': len(analysis_df),
            'transfer_count': len(self.df[self.df['is_internal_transfer']])
        }

    def get_category_analysis(self):
        """
        Analyze spending by category.

        Returns:
            DataFrame with category breakdown
        """
        analysis_df = self.get_analysis_data()

        category_data = []
        for category in sorted(analysis_df['category'].unique()):
            cat_df = analysis_df[analysis_df['category'] == category]

            inflows = cat_df[cat_df['amount'] > 0]
            outflows = cat_df[cat_df['amount'] < 0]

            category_data.append({
                'Category': category,
                'Inflow Count': len(inflows),
                'Inflow Total': inflows['amount'].sum(),
                'Outflow Count': len(outflows),
                'Outflow Total': abs(outflows['amount'].sum()),
                'Net Amount': cat_df['amount'].sum()
            })

        df = pd.DataFrame(category_data)
        df = df.sort_values('Outflow Total', ascending=False)

        return df

    def get_account_analysis(self):
        """
        Analyze spending by account.

        Returns:
            DataFrame with account breakdown
        """
        analysis_df = self.get_analysis_data()

        account_data = []
        for account in sorted(analysis_df['account'].unique()):
            acc_df = analysis_df[analysis_df['account'] == account]

            inflows = acc_df[acc_df['amount'] > 0]['amount'].sum()
            outflows = abs(acc_df[acc_df['amount'] < 0]['amount'].sum())
            net = acc_df['amount'].sum()

            account_data.append({
                'Account': account,
                'Inflows': inflows,
                'Outflows': outflows,
                'Net': net
            })

        df = pd.DataFrame(account_data)
        df = df.sort_values('Outflows', ascending=False)

        return df

    def get_merchant_analysis(self, top_n=20):
        """
        Analyze top spending by merchant.

        Returns:
            DataFrame with top merchants
        """
        analysis_df = self.get_analysis_data()

        # Only look at outflows (spending)
        spending = analysis_df[analysis_df['amount'] < 0].copy()
        spending['abs_amount'] = abs(spending['amount'])

        merchant_spending = spending.groupby('merchant').agg({
            'abs_amount': 'sum',
            'description': 'count'
        }).reset_index()

        merchant_spending.columns = ['Merchant', 'Total Spent', 'Transaction Count']
        merchant_spending = merchant_spending.sort_values('Total Spent', ascending=False)

        return merchant_spending.head(top_n)

    def get_monthly_trend(self):
        """
        Analyze spending trends by month.

        Returns:
            DataFrame with monthly breakdown
        """
        analysis_df = self.get_analysis_data()
        analysis_df['month'] = analysis_df['date'].dt.to_period('M')

        monthly_data = []
        for month in sorted(analysis_df['month'].unique()):
            month_df = analysis_df[analysis_df['month'] == month]

            inflows = month_df[month_df['amount'] > 0]['amount'].sum()
            outflows = abs(month_df[month_df['amount'] < 0]['amount'].sum())

            monthly_data.append({
                'Month': str(month),
                'Inflows': inflows,
                'Outflows': outflows,
                'Net': inflows - outflows
            })

        return pd.DataFrame(monthly_data)

    def get_transaction_list(self, include_transfers=False):
        """
        Get formatted transaction list.

        Args:
            include_transfers: Whether to include internal transfers

        Returns:
            DataFrame with formatted transactions
        """
        if include_transfers:
            df = self.df.copy()
        else:
            df = self.get_analysis_data()

        # Format for display
        display_df = df[[
            'date', 'merchant', 'category', 'amount', 'account', 'description'
        ]].copy()

        display_df['date'] = display_df['date'].dt.strftime('%Y-%m-%d')
        display_df = display_df.sort_values('date', ascending=False)

        display_df.columns = [
            'Date', 'Merchant', 'Category', 'Amount', 'Account', 'Description'
        ]

        return display_df
