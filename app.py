"""
Household Finance Analyzer - Web Interface
"""
import streamlit as st
import pandas as pd
import os
from dotenv import load_dotenv

from parser import TransactionParser
from deduplicator import MerchantDeduplicator
from classifier import TransactionClassifier
from analyzer import SpendingAnalyzer

# Load environment variables
load_dotenv()

# Page config
st.set_page_config(
    page_title="Household Finance Analyzer",
    page_icon="💰",
    layout="wide"
)

# Initialize session state
if 'stage' not in st.session_state:
    st.session_state.stage = 'upload'
if 'transactions_df' not in st.session_state:
    st.session_state.transactions_df = None
if 'merchant_mapping_df' not in st.session_state:
    st.session_state.merchant_mapping_df = None
if 'category_mapping_df' not in st.session_state:
    st.session_state.category_mapping_df = None


def main():
    st.title("💰 Household Finance Analyzer")
    st.markdown("---")

    # Sidebar for file uploads
    with st.sidebar:
        st.header("📁 Upload Files")

        st.subheader("Transaction Files")
        deane_monzo = st.file_uploader("Deane Monzo CSV", type=['csv'], key='deane_monzo')
        thea_monzo = st.file_uploader("Thea Monzo CSV", type=['csv'], key='thea_monzo')
        joint_monzo = st.file_uploader("Joint Monzo CSV", type=['csv'], key='joint_monzo')
        gold_amex = st.file_uploader("Gold Amex CSV", type=['csv'], key='gold_amex')
        ba_amex = st.file_uploader("BA Amex CSV", type=['csv'], key='ba_amex')

        st.markdown("---")
        st.subheader("Optional: Previous Mappings")
        merchant_mapping_file = st.file_uploader(
            "Merchant Deduplication Mapping",
            type=['csv'],
            key='merchant_mapping',
            help="Upload previous merchant_mapping.csv to reuse deduplication rules"
        )
        category_mapping_file = st.file_uploader(
            "Category Mapping",
            type=['csv'],
            key='category_mapping',
            help="Upload previous category_mapping.csv to reuse categorization rules"
        )

        st.markdown("---")
        api_key = st.text_input(
            "OpenAI API Key",
            type="password",
            value=os.getenv('OPENAI_API_KEY', ''),
            help="Required for AI-powered categorization of new merchants"
        )

        st.markdown("---")
        if st.button("🚀 Process Transactions", type="primary", use_container_width=True):
            process_transactions(
                deane_monzo, thea_monzo, joint_monzo, gold_amex, ba_amex,
                merchant_mapping_file, category_mapping_file, api_key
            )

        if st.session_state.stage != 'upload':
            if st.button("🔄 Start Over", use_container_width=True):
                for key in list(st.session_state.keys()):
                    del st.session_state[key]
                st.rerun()

    # Main content area
    if st.session_state.stage == 'upload':
        show_welcome_screen()
    elif st.session_state.stage == 'review_merchant_mapping':
        show_merchant_mapping_review()
    elif st.session_state.stage == 'review_category_mapping':
        show_category_mapping_review()
    elif st.session_state.stage == 'analysis':
        show_analysis()


def show_welcome_screen():
    st.info("👈 Upload your transaction CSV files and click 'Process Transactions' to get started")

    with st.expander("ℹ️ How to use this tool"):
        st.markdown("""
        ### Step-by-step guide:

        1. **Upload transaction files** for your accounts (CSV format)
        2. *Optional:* Upload previous mapping files to reuse your categorization rules
        3. **Review merchant deduplication** - standardize merchant names (e.g., "AMAZON.CO.UK" → "Amazon")
        4. **Review category mapping** - assign categories to each merchant
        5. **View analysis** - see spending breakdown by category, account, and merchant
        6. **Export mappings** - download mapping files to reuse next time

        ### Tips:
        - You can upload files for any subset of accounts (don't need all 5)
        - Merchant deduplication happens first to consolidate variations of the same merchant
        - Category mapping happens second, using your previous mappings + AI for new merchants
        - Save your mapping files at the end to make next month's analysis much faster!
        """)


def process_transactions(deane_monzo, thea_monzo, joint_monzo, gold_amex, ba_amex,
                        merchant_mapping_file, category_mapping_file, api_key):
    """Process uploaded transaction files."""

    # Check if at least one file is uploaded
    files = [deane_monzo, thea_monzo, joint_monzo, gold_amex, ba_amex]
    if not any(files):
        st.error("Please upload at least one transaction file")
        return

    with st.spinner("Processing transactions..."):
        try:
            # Step 1: Load and parse transactions
            parser = TransactionParser()
            files_dict = {
                'deane_monzo': deane_monzo.read() if deane_monzo else None,
                'thea_monzo': thea_monzo.read() if thea_monzo else None,
                'joint_monzo': joint_monzo.read() if joint_monzo else None,
                'gold_amex': gold_amex.read() if gold_amex else None,
                'ba_amex': ba_amex.read() if ba_amex else None,
            }

            df = parser.load_all_transactions(files_dict)

            if df.empty:
                st.error("No transactions found in uploaded files")
                return

            # Identify internal transfers
            df = parser.identify_internal_transfers(df)

            st.session_state.transactions_df = df

            # Step 2: Load or create merchant mapping
            existing_merchant_mapping = None
            if merchant_mapping_file:
                existing_merchant_mapping = MerchantDeduplicator.load_mapping_from_csv(
                    merchant_mapping_file.read()
                )

            deduplicator = MerchantDeduplicator(existing_merchant_mapping)
            unique_merchants = deduplicator.extract_unique_merchants(df)
            merchant_mapping_df = deduplicator.build_mapping_dataframe(unique_merchants)

            st.session_state.merchant_mapping_df = merchant_mapping_df
            st.session_state.deduplicator = deduplicator

            # Step 3: Load existing category mapping if provided
            if category_mapping_file:
                st.session_state.existing_category_mapping = TransactionClassifier.load_mapping_from_csv(
                    category_mapping_file.read()
                )
            else:
                st.session_state.existing_category_mapping = None

            st.session_state.api_key = api_key
            st.session_state.stage = 'review_merchant_mapping'

            st.success(f"✅ Loaded {len(df)} transactions!")
            st.rerun()

        except Exception as e:
            st.error(f"Error processing files: {str(e)}")


def show_merchant_mapping_review():
    """Show merchant deduplication mapping for review."""
    st.header("🏪 Step 1: Review Merchant Deduplication")

    st.info("""
    Review and edit how merchant names are standardized.
    This consolidates variations like "AMAZON.CO.UK", "Amazon UK", "AMAZON" into a single name like "Amazon".
    """)

    # Show editable dataframe
    edited_df = st.data_editor(
        st.session_state.merchant_mapping_df,
        use_container_width=True,
        num_rows="fixed",
        column_config={
            "raw_merchant": st.column_config.TextColumn(
                "Raw Merchant Name",
                help="Original merchant name from transaction",
                disabled=True,
                width="large"
            ),
            "standardized_merchant": st.column_config.TextColumn(
                "Standardized Name",
                help="Edit to standardize merchant names",
                width="medium"
            )
        },
        hide_index=True,
        height=400
    )

    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("✅ Confirm & Continue", type="primary"):
            st.session_state.merchant_mapping_df = edited_df

            # Apply merchant mapping
            deduplicator = st.session_state.deduplicator
            df = deduplicator.apply_mapping(
                st.session_state.transactions_df,
                edited_df
            )
            st.session_state.transactions_df = df

            # Move to category mapping
            st.session_state.stage = 'review_category_mapping'
            st.rerun()


def show_category_mapping_review():
    """Show category mapping for review and AI classification."""
    st.header("📊 Step 2: Review Category Mapping")

    df = st.session_state.transactions_df
    api_key = st.session_state.api_key

    # Initialize classifier with existing mapping
    existing_mapping = st.session_state.existing_category_mapping
    classifier = TransactionClassifier(api_key, existing_mapping)

    # Build category mapping dataframe
    category_mapping_df = classifier.build_mapping_dataframe(df)

    # Check if we need AI classification
    unclassified = category_mapping_df[
        (category_mapping_df['category'].isna()) | (category_mapping_df['category'] == '')
    ]

    if len(unclassified) > 0 and api_key:
        st.info(f"🤖 Found {len(unclassified)} merchants without categories. Using AI to classify...")

        with st.spinner("Classifying with AI..."):
            try:
                merchants_to_classify = unclassified['merchant'].tolist()
                classifications = classifier.classify_merchants(merchants_to_classify)

                # Update mapping with AI classifications
                for merchant, category in classifications.items():
                    category_mapping_df.loc[
                        category_mapping_df['merchant'] == merchant,
                        'category'
                    ] = category

                st.success("✅ AI classification complete!")

            except Exception as e:
                st.warning(f"AI classification failed: {str(e)}. Please categorize manually.")

    # Show editable dataframe
    st.info("Review and edit category assignments below. Changes are saved when you click 'Confirm & Continue'.")

    edited_category_df = st.data_editor(
        category_mapping_df,
        use_container_width=True,
        num_rows="fixed",
        column_config={
            "merchant": st.column_config.TextColumn(
                "Merchant",
                help="Standardized merchant name",
                disabled=True,
                width="large"
            ),
            "category": st.column_config.SelectboxColumn(
                "Category",
                help="Select category for this merchant",
                options=TransactionClassifier.STANDARD_CATEGORIES,
                width="medium"
            )
        },
        hide_index=True,
        height=400
    )

    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("✅ Confirm & Continue", type="primary"):
            st.session_state.category_mapping_df = edited_category_df

            # Apply category mapping
            df = classifier.apply_categories(df, edited_category_df)
            st.session_state.transactions_df = df

            # Move to analysis
            st.session_state.stage = 'analysis'
            st.rerun()


def show_analysis():
    """Show spending analysis and export options."""
    st.header("📊 Spending Analysis")

    df = st.session_state.transactions_df
    analyzer = SpendingAnalyzer(df)

    # Summary statistics
    summary = analyzer.get_summary_stats()

    st.subheader("💰 Summary")
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Total Inflows", f"£{summary['total_inflows']:,.2f}")
    with col2:
        st.metric("Total Outflows", f"£{summary['total_outflows']:,.2f}")
    with col3:
        st.metric("Net Cash Flow", f"£{summary['net_cashflow']:,.2f}")
    with col4:
        st.metric("Transactions", f"{summary['transaction_count']}")

    st.caption(f"📅 Period: {summary['date_range'][0]} to {summary['date_range'][1]}")
    if summary['transfer_count'] > 0:
        st.caption(f"ℹ️ {summary['transfer_count']} internal transfers excluded from analysis")

    st.markdown("---")

    # Category analysis
    st.subheader("📊 Spending by Category")
    category_df = analyzer.get_category_analysis()

    # Format for display
    display_category_df = category_df.copy()
    display_category_df['Inflow Total'] = display_category_df['Inflow Total'].apply(lambda x: f"£{x:,.2f}")
    display_category_df['Outflow Total'] = display_category_df['Outflow Total'].apply(lambda x: f"£{x:,.2f}")
    display_category_df['Net Amount'] = display_category_df['Net Amount'].apply(lambda x: f"£{x:,.2f}")

    st.dataframe(display_category_df, use_container_width=True, hide_index=True)

    st.markdown("---")

    # Account analysis
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("🏦 Spending by Account")
        account_df = analyzer.get_account_analysis()

        display_account_df = account_df.copy()
        display_account_df['Inflows'] = display_account_df['Inflows'].apply(lambda x: f"£{x:,.2f}")
        display_account_df['Outflows'] = display_account_df['Outflows'].apply(lambda x: f"£{x:,.2f}")
        display_account_df['Net'] = display_account_df['Net'].apply(lambda x: f"£{x:,.2f}")

        st.dataframe(display_account_df, use_container_width=True, hide_index=True)

    with col2:
        st.subheader("🏪 Top 10 Merchants by Spending")
        merchant_df = analyzer.get_merchant_analysis(top_n=10)

        display_merchant_df = merchant_df.copy()
        display_merchant_df['Total Spent'] = display_merchant_df['Total Spent'].apply(lambda x: f"£{x:,.2f}")

        st.dataframe(display_merchant_df, use_container_width=True, hide_index=True)

    st.markdown("---")

    # Monthly trend
    monthly_df = analyzer.get_monthly_trend()
    if len(monthly_df) > 1:
        st.subheader("📈 Monthly Trend")
        display_monthly_df = monthly_df.copy()
        display_monthly_df['Inflows'] = display_monthly_df['Inflows'].apply(lambda x: f"£{x:,.2f}")
        display_monthly_df['Outflows'] = display_monthly_df['Outflows'].apply(lambda x: f"£{x:,.2f}")
        display_monthly_df['Net'] = display_monthly_df['Net'].apply(lambda x: f"£{x:,.2f}")
        st.dataframe(display_monthly_df, use_container_width=True, hide_index=True)

    st.markdown("---")

    # Transaction list
    with st.expander("📝 View All Transactions", expanded=False):
        transaction_list = analyzer.get_transaction_list(include_transfers=False)
        st.dataframe(transaction_list, use_container_width=True, hide_index=True, height=400)

    st.markdown("---")

    # Export section
    st.subheader("💾 Export Data")

    col1, col2, col3 = st.columns(3)

    with col1:
        # Export merchant mapping
        merchant_csv = MerchantDeduplicator.export_mapping_to_csv(
            st.session_state.merchant_mapping_df
        )
        st.download_button(
            label="📥 Download Merchant Mapping",
            data=merchant_csv,
            file_name="merchant_mapping.csv",
            mime="text/csv",
            help="Save this to reuse merchant standardization next time"
        )

    with col2:
        # Export category mapping
        category_csv = TransactionClassifier.export_mapping_to_csv(
            st.session_state.category_mapping_df
        )
        st.download_button(
            label="📥 Download Category Mapping",
            data=category_csv,
            file_name="category_mapping.csv",
            mime="text/csv",
            help="Save this to reuse category assignments next time"
        )

    with col3:
        # Export all transactions
        transactions_csv = df.to_csv(index=False)
        st.download_button(
            label="📥 Download All Transactions",
            data=transactions_csv,
            file_name="transactions_analyzed.csv",
            mime="text/csv",
            help="All transactions with standardized merchants and categories"
        )


if __name__ == "__main__":
    main()
