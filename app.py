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
if 'uploaded_files' not in st.session_state:
    st.session_state.uploaded_files = {}
if 'sheet_selections' not in st.session_state:
    st.session_state.sheet_selections = {}


def main():
    st.title("💰 Household Finance Analyzer")
    st.markdown("---")

    # Sidebar for file uploads
    with st.sidebar:
        st.header("📁 Upload Files")

        st.subheader("Transaction Files")
        deane_monzo = st.file_uploader("Deane Monzo", type=['csv', 'xlsx', 'xls'], key='deane_monzo')
        thea_monzo = st.file_uploader("Thea Monzo", type=['csv', 'xlsx', 'xls'], key='thea_monzo')
        joint_monzo = st.file_uploader("Joint Monzo", type=['csv', 'xlsx', 'xls'], key='joint_monzo')
        gold_amex = st.file_uploader("Gold Amex", type=['csv', 'xlsx', 'xls'], key='gold_amex')
        ba_amex = st.file_uploader("BA Amex", type=['csv', 'xlsx', 'xls'], key='ba_amex')

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

        # Show API key status
        if hasattr(st.session_state, 'api_key') and st.session_state.api_key:
            if st.session_state.api_key.strip():
                st.success("✓ API key loaded")
            else:
                st.warning("⚠ No API key - manual categorization only")
        elif api_key and api_key.strip():
            st.info("💡 Click 'Process Transactions' to save API key")

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
    elif st.session_state.stage == 'select_sheets':
        show_sheet_selection()
    elif st.session_state.stage == 'review_merchant_mapping':
        show_merchant_mapping_review()
    elif st.session_state.stage == 'review_merchant_categories':
        show_merchant_category_mapping()
    elif st.session_state.stage == 'review_transaction_categories':
        show_transaction_category_review()
    elif st.session_state.stage == 'review_by_category':
        show_category_based_review()
    elif st.session_state.stage == 'analysis':
        show_analysis()


def show_welcome_screen():
    st.info("👈 Upload your transaction files (CSV or Excel) and click 'Process Transactions' to get started")

    with st.expander("ℹ️ How to use this tool"):
        st.markdown("""
        ### Step-by-step guide:

        1. **Upload transaction files** for your accounts (CSV or Excel format)
        2. *If using Excel:* Select which sheet contains your transaction data (if multiple sheets)
        3. *Optional:* Upload previous mapping files to reuse your categorization rules
        4. **Review merchant deduplication** - standardize merchant names (e.g., "AMAZON.CO.UK" → "Amazon")
        5. **Review merchant category mapping** - assign default categories to each merchant (AI-assisted)
        6. **Review transaction categories** - edit individual transactions as needed (e.g., mark some Amazon purchases as work expenses)
        7. **View analysis** - see spending breakdown by category, account, and merchant
           - Internal transfers between accounts are automatically identified and excluded
        8. **Filter by date** - analyze spending for specific time periods (e.g., single month)
        9. **Export mappings** - download mapping files to reuse next time

        ### Tips:
        - You can upload files for any subset of accounts (don't need all 5)
        - Both CSV and Excel (XLS/XLSX) files are supported
        - Bank transfers are handled separately from card transactions
        - Merchant categories provide defaults, but you can override individual transactions
        - Internal transfers are excluded from spending analysis to avoid double-counting
        - Use the date filter to focus on specific months or periods
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

    try:
        parser = TransactionParser()

        # Store uploaded files and check for Excel with multiple sheets
        uploaded_files_info = {}
        needs_sheet_selection = False

        file_map = {
            'deane_monzo': deane_monzo,
            'thea_monzo': thea_monzo,
            'joint_monzo': joint_monzo,
            'gold_amex': gold_amex,
            'ba_amex': ba_amex
        }

        for account_key, file in file_map.items():
            if file is None:
                continue

            file_content = file.read()
            file_type = file.name.split('.')[-1].lower()

            # Check if Excel file has multiple sheets
            if file_type in ['xlsx', 'xls']:
                sheets = parser.get_excel_sheets(file_content)
                if len(sheets) > 1:
                    needs_sheet_selection = True
                    uploaded_files_info[account_key] = {
                        'content': file_content,
                        'type': file_type,
                        'sheets': sheets,
                        'selected_sheet': sheets[0]  # Default to first sheet
                    }
                else:
                    uploaded_files_info[account_key] = {
                        'content': file_content,
                        'type': file_type,
                        'sheets': sheets,
                        'selected_sheet': sheets[0]
                    }
            else:
                uploaded_files_info[account_key] = {
                    'content': file_content,
                    'type': file_type,
                    'sheets': None,
                    'selected_sheet': None
                }

        # Store in session state
        st.session_state.uploaded_files = uploaded_files_info
        st.session_state.merchant_mapping_file = merchant_mapping_file
        st.session_state.category_mapping_file = category_mapping_file
        st.session_state.api_key = api_key

        # If we need sheet selection, go to that stage, otherwise process directly
        if needs_sheet_selection:
            st.session_state.stage = 'select_sheets'
            st.rerun()
        else:
            process_with_selected_sheets()

    except Exception as e:
        st.error(f"Error processing files: {str(e)}")


def show_sheet_selection():
    """Show Excel sheet selection interface."""
    st.header("📋 Select Excel Sheets")

    st.info("Some of your Excel files have multiple sheets. Please select which sheet contains the transaction data.")

    # Show selection dropdowns for files with multiple sheets
    for account_key, file_info in st.session_state.uploaded_files.items():
        if file_info['sheets'] and len(file_info['sheets']) > 1:
            account_name = account_key.replace('_', ' ').title()
            selected = st.selectbox(
                f"{account_name} - Select Sheet:",
                options=file_info['sheets'],
                index=0,
                key=f"sheet_select_{account_key}"
            )
            st.session_state.uploaded_files[account_key]['selected_sheet'] = selected

    if st.button("✅ Continue with Selected Sheets", type="primary"):
        process_with_selected_sheets()


def process_with_selected_sheets():
    """Process transactions with selected sheets."""
    with st.spinner("Processing transactions..."):
        try:
            parser = TransactionParser()

            # Build files_dict with proper structure
            files_dict = {}
            for account_key, file_info in st.session_state.uploaded_files.items():
                files_dict[account_key] = (
                    file_info['content'],
                    file_info['type'],
                    file_info['selected_sheet']
                )

            df = parser.load_all_transactions(files_dict)

            if df.empty:
                st.error("No transactions found in uploaded files")
                return

            # Identify internal transfers
            df = parser.identify_internal_transfers(df)

            st.session_state.transactions_df = df

            # Load or create merchant mapping
            existing_merchant_mapping = None
            if st.session_state.merchant_mapping_file:
                existing_merchant_mapping = MerchantDeduplicator.load_mapping_from_csv(
                    st.session_state.merchant_mapping_file.read()
                )

            deduplicator = MerchantDeduplicator(existing_merchant_mapping)
            unique_merchants = deduplicator.extract_unique_merchants(df)
            merchant_mapping_df = deduplicator.build_mapping_dataframe(unique_merchants)

            st.session_state.merchant_mapping_df = merchant_mapping_df
            st.session_state.deduplicator = deduplicator

            # Load existing category mapping if provided
            if st.session_state.category_mapping_file:
                st.session_state.existing_category_mapping = TransactionClassifier.load_mapping_from_csv(
                    st.session_state.category_mapping_file.read()
                )
            else:
                st.session_state.existing_category_mapping = None

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
    This consolidates variations like "AMAZON.CO.UK +442080680807 GBR", "Amazon UK", "AMAZON" into a single name like "Amazon".
    """)

    # AI Enhancement Option
    api_key = st.session_state.api_key
    if api_key and api_key.strip():
        col_btn1, col_btn2, col_spacer = st.columns([1, 1, 3])
        with col_btn1:
            if st.button("🤖 Improve with AI", help="Use AI to better consolidate similar merchant names"):
                with st.spinner("Using AI to improve deduplication..."):
                    try:
                        from classifier import TransactionClassifier
                        classifier = TransactionClassifier(api_key, None)

                        # Get unique merchants to improve
                        df_to_improve = st.session_state.merchant_mapping_df.copy()

                        # Call AI to consolidate
                        improved_mapping = ai_improve_deduplication(classifier, df_to_improve)
                        st.session_state.merchant_mapping_df = improved_mapping
                        st.success("✅ AI deduplication complete! Review the suggestions below.")
                        st.rerun()

                    except Exception as e:
                        st.warning(f"⚠️ AI enhancement failed: {str(e)}. Manual editing still available.")

    # Calculate dynamic height based on number of rows (max 70% of viewport)
    num_rows = len(st.session_state.merchant_mapping_df)
    table_height = min(35 * num_rows + 38, 700)  # 35px per row + 38px header, max 700px

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
                help="Edit to standardize merchant names - remove phone numbers, locations, etc.",
                width="large"
            )
        },
        hide_index=True,
        height=table_height
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

            # Move to merchant category mapping
            st.session_state.stage = 'review_merchant_categories'
            st.rerun()


def ai_improve_deduplication(classifier, mapping_df):
    """Use AI to improve merchant deduplication."""
    # Group similar merchants and ask AI to consolidate
    merchants = mapping_df['standardized_merchant'].unique().tolist()

    # Batch process in groups of 30
    batch_size = 30
    all_improvements = {}

    for i in range(0, len(merchants), batch_size):
        batch = merchants[i:i+batch_size]
        batch_text = "\n".join([f"{idx}: {m}" for idx, m in enumerate(batch)])

        prompt = f"""Review these merchant names and consolidate duplicates. Return a JSON mapping where the key is the index number and the value is the best consolidated merchant name.

For example, if you see:
- "Gett +442080680807"
- "Gett +441234567890"
Both should map to just "Gett"

Or if you see:
- "Google *Chrome Temp"
- "Google *Gpay Temp"
- "Google *Youtube Temp"
All should map to "Google"

Merchants:
{batch_text}

Return only JSON in format: {{"0": "ConsolidatedName", "1": "ConsolidatedName", ...}}
Remove phone numbers, location codes, temporary hold indicators, and branch/store numbers."""

        try:
            response = classifier.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a merchant name deduplication expert. Consolidate similar merchant names into clean, standard names."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=800
            )

            response_text = response.choices[0].message.content
            parsed = classifier._parse_json_response(response_text)

            # Map back to merchant names
            for idx_str, consolidated_name in parsed.items():
                idx = int(idx_str)
                if idx < len(batch):
                    original = batch[idx]
                    all_improvements[original] = consolidated_name

        except Exception as e:
            print(f"Error in batch: {e}")
            continue

    # Apply improvements to mapping_df
    improved_df = mapping_df.copy()
    for idx, row in improved_df.iterrows():
        current_standardized = row['standardized_merchant']
        if current_standardized in all_improvements:
            improved_df.at[idx, 'standardized_merchant'] = all_improvements[current_standardized]

    return improved_df


def show_merchant_category_mapping():
    """Show merchant-level category mapping for defaults."""
    st.header("📊 Step 2: Map Merchant Categories (Defaults)")

    df = st.session_state.transactions_df
    api_key = st.session_state.api_key

    # Initialize custom categories in session state if not present
    if 'custom_categories' not in st.session_state:
        st.session_state.custom_categories = list(TransactionClassifier.STANDARD_CATEGORIES)

    # Build category mapping dataframe
    existing_mapping = st.session_state.existing_category_mapping

    # Get unique merchants (exclude bank transfers)
    unique_merchants = sorted(df[df['is_bank_transfer'] == False]['merchant'].unique())

    # Build mapping data with raw description examples
    mapping_data = []
    existing_dict = {}
    if existing_mapping is not None and not existing_mapping.empty:
        for _, row in existing_mapping.iterrows():
            existing_dict[row['merchant']] = row['category']
            # Add category to custom list if not already there
            if pd.notna(row['category']) and row['category'] not in st.session_state.custom_categories:
                st.session_state.custom_categories.append(row['category'])

    for merchant in unique_merchants:
        category = existing_dict.get(merchant, None)
        # Get a sample raw description for this merchant
        sample_raw = df[df['merchant'] == merchant]['raw_description'].iloc[0]
        mapping_data.append({
            'merchant': merchant,
            'raw_description': sample_raw,
            'category': category if category else '',
            'is_mapped': category is not None and category != ''
        })

    category_mapping_df = pd.DataFrame(mapping_data)

    # Split into mapped and unmapped
    mapped_df = category_mapping_df[category_mapping_df['is_mapped']].copy()
    unmapped_df = category_mapping_df[~category_mapping_df['is_mapped']].copy()

    # AI classification for unmapped merchants
    if len(unmapped_df) > 0 and api_key and api_key.strip():
        if st.button("🤖 Classify New Merchants with AI"):
            with st.spinner("Classifying with AI..."):
                try:
                    classifier = TransactionClassifier(api_key, existing_mapping)
                    merchants_with_raw = unmapped_df[['merchant', 'raw_description']].to_dict('records')
                    classifications = classifier.classify_merchants(merchants_with_raw)

                    # Update unmapped_df with AI classifications
                    for merchant, category in classifications.items():
                        unmapped_df.loc[
                            unmapped_df['merchant'] == merchant,
                            'category'
                        ] = category

                    st.success("✅ AI classification complete!")
                    st.rerun()

                except Exception as e:
                    st.warning(f"⚠️ AI classification failed: {str(e)}. Please categorize manually.")

    # Category management section
    with st.expander("⚙️ Manage Categories"):
        st.subheader("Current Categories")

        col1, col2 = st.columns([3, 1])
        with col1:
            new_category = st.text_input("Add new category:", key='new_category_input')
        with col2:
            st.markdown("<br>", unsafe_allow_html=True)
            if st.button("➕ Add"):
                if new_category and new_category not in st.session_state.custom_categories:
                    st.session_state.custom_categories.append(new_category)
                    st.success(f"Added category: {new_category}")
                    st.rerun()

        # Show current categories
        st.write("**Available categories:**")
        categories_text = ", ".join(sorted(st.session_state.custom_categories))
        st.text(categories_text)

    # Tabs for mapped vs unmapped
    if len(mapped_df) > 0 and len(unmapped_df) > 0:
        tab1, tab2 = st.tabs([
            f"✅ Already Mapped ({len(mapped_df)})",
            f"🆕 New Merchants ({len(unmapped_df)})"
        ])
    else:
        tab1 = tab2 = None

    # Show already mapped merchants
    if len(mapped_df) > 0:
        if tab1:
            with tab1:
                st.info("These merchants were mapped from your uploaded file. Review and edit if needed.")
                edited_mapped_df = show_category_editor(mapped_df, "mapped")
        else:
            st.info("These merchants were mapped from your uploaded file. Review and edit if needed.")
            edited_mapped_df = show_category_editor(mapped_df, "mapped")
    else:
        edited_mapped_df = pd.DataFrame()

    # Show new merchants
    if len(unmapped_df) > 0:
        if tab2:
            with tab2:
                st.info("These are new merchants. AI has suggested categories, but please review and edit.")
                edited_unmapped_df = show_category_editor(unmapped_df, "unmapped")
        else:
            st.info("These are new merchants. Assign categories below.")
            edited_unmapped_df = show_category_editor(unmapped_df, "unmapped")
    else:
        edited_unmapped_df = pd.DataFrame()

    # Combine both dataframes
    if len(edited_mapped_df) > 0 and len(edited_unmapped_df) > 0:
        final_mapping_df = pd.concat([edited_mapped_df, edited_unmapped_df], ignore_index=True)
    elif len(edited_mapped_df) > 0:
        final_mapping_df = edited_mapped_df
    else:
        final_mapping_df = edited_unmapped_df

    st.markdown("---")
    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("✅ Confirm & Continue", type="primary"):
            # Store merchant category mapping (will be used as defaults for transactions)
            st.session_state.merchant_category_mapping = final_mapping_df[['merchant', 'category']]

            # Move to transaction-level categorization
            st.session_state.stage = 'review_transaction_categories'
            st.rerun()


def show_category_editor(df, key_suffix):
    """Show category editor with raw descriptions."""
    edited_df = st.data_editor(
        df[['merchant', 'raw_description', 'category']],
        use_container_width=True,
        num_rows="fixed",
        column_config={
            "merchant": st.column_config.TextColumn(
                "Merchant",
                help="Standardized merchant name",
                disabled=True,
                width="medium"
            ),
            "raw_description": st.column_config.TextColumn(
                "Raw Description",
                help="Original transaction description",
                disabled=True,
                width="large"
            ),
            "category": st.column_config.SelectboxColumn(
                "Category",
                help="Type to search and select category",
                options=st.session_state.custom_categories,
                width="medium"
            )
        },
        hide_index=True,
        height=min(400, 35 * len(df) + 38),
        key=f'category_editor_{key_suffix}'
    )
    return edited_df


def show_transaction_category_review():
    """Show transaction-level category review and editing."""
    st.header("💳 Step 3: Review Transaction Categories")

    st.info("""
    Review and edit categories for individual transactions.
    Merchant categories are applied as defaults, but you can override any transaction
    (e.g., some Amazon purchases might be work expenses).
    """)

    df = st.session_state.transactions_df.copy()
    merchant_categories = st.session_state.merchant_category_mapping

    # Apply merchant categories as defaults to card transactions
    merchant_cat_dict = {}
    for _, row in merchant_categories.iterrows():
        if pd.notna(row['category']) and row['category']:
            merchant_cat_dict[row['merchant']] = row['category']

    # Apply merchant categories to transactions without categories
    for idx, row in df.iterrows():
        if row['is_bank_transfer']:
            # Bank transfers always get 'Transfers' category
            df.at[idx, 'category'] = 'Transfers'
        elif pd.isna(row.get('category')) or row.get('category') == '':
            # Apply merchant category if available
            merchant = row['merchant']
            if merchant in merchant_cat_dict:
                df.at[idx, 'category'] = merchant_cat_dict[merchant]
            else:
                df.at[idx, 'category'] = 'Uncategorized'

    # Split into categorized vs uncategorized (excluding bank transfers from the tables)
    card_transactions = df[df['is_bank_transfer'] == False].copy()

    categorized = card_transactions[
        (card_transactions['category'].notna()) &
        (card_transactions['category'] != '') &
        (card_transactions['category'] != 'Uncategorized')
    ].copy()

    uncategorized = card_transactions[
        (card_transactions['category'].isna()) |
        (card_transactions['category'] == '') |
        (card_transactions['category'] == 'Uncategorized')
    ].copy()

    # Add bank transfer summary
    num_transfers = len(df[df['is_bank_transfer'] == True])
    if num_transfers > 0:
        st.success(f"ℹ️ {num_transfers} bank transfers automatically categorized as 'Transfers' (excluded from editing)")

    # Tabs for categorized vs uncategorized
    if len(categorized) > 0 and len(uncategorized) > 0:
        tab1, tab2 = st.tabs([
            f"✅ Categorized ({len(categorized)})",
            f"⚠️ Needs Categorization ({len(uncategorized)})"
        ])
    else:
        tab1 = tab2 = None

    # Show categorized transactions
    edited_categorized = pd.DataFrame()
    if len(categorized) > 0:
        if tab1:
            with tab1:
                st.info("These transactions have categories. Review and edit individual transactions if needed.")
                edited_categorized = show_transaction_editor(categorized, "categorized")
        else:
            st.info("These transactions have categories. Review and edit individual transactions if needed.")
            edited_categorized = show_transaction_editor(categorized, "categorized")

    # Show uncategorized transactions
    edited_uncategorized = pd.DataFrame()
    if len(uncategorized) > 0:
        if tab2:
            with tab2:
                st.warning("These transactions need categories. Assign them below.")
                edited_uncategorized = show_transaction_editor(uncategorized, "uncategorized")
        else:
            st.warning("These transactions need categories. Assign them below.")
            edited_uncategorized = show_transaction_editor(uncategorized, "uncategorized")

    st.markdown("---")
    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("✅ Confirm & Continue", type="primary"):
            # Merge edited dataframes back
            if len(edited_categorized) > 0:
                for idx, row in edited_categorized.iterrows():
                    df.at[idx, 'category'] = row['category']

            if len(edited_uncategorized) > 0:
                for idx, row in edited_uncategorized.iterrows():
                    df.at[idx, 'category'] = row['category']

            # Store updated transactions
            st.session_state.transactions_df = df

            # Identify internal transfers between accounts
            parser = TransactionParser()
            df = parser.identify_internal_transfers(df)
            st.session_state.transactions_df = df

            # Move to category-based review
            st.session_state.stage = 'review_by_category'
            st.rerun()


def show_transaction_editor(df, key_suffix):
    """Show transaction editor with all fields."""
    # Prepare display columns
    display_df = df[[
        'date', 'account', 'merchant', 'raw_description', 'amount', 'category'
    ]].copy()

    display_df['date'] = display_df['date'].dt.strftime('%Y-%m-%d')
    display_df['amount'] = display_df['amount'].round(2)

    edited_df = st.data_editor(
        display_df,
        use_container_width=True,
        num_rows="fixed",
        column_config={
            "date": st.column_config.TextColumn(
                "Date",
                disabled=True,
                width="small"
            ),
            "account": st.column_config.TextColumn(
                "Account",
                disabled=True,
                width="small"
            ),
            "merchant": st.column_config.TextColumn(
                "Merchant",
                disabled=True,
                width="medium"
            ),
            "raw_description": st.column_config.TextColumn(
                "Raw Description",
                disabled=True,
                width="large"
            ),
            "amount": st.column_config.NumberColumn(
                "Amount",
                disabled=True,
                width="small",
                format="£%.2f"
            ),
            "category": st.column_config.SelectboxColumn(
                "Category",
                help="Edit category for this transaction",
                options=st.session_state.custom_categories,
                width="medium",
                required=True
            )
        },
        hide_index=True,
        height=min(500, 35 * len(display_df) + 38),
        key=f'transaction_editor_{key_suffix}'
    )

    # Map back to original indices
    edited_df.index = df.index
    return edited_df


def show_category_based_review():
    """Show transactions grouped by category for final review and editing."""
    st.header("📋 Step 4: Review Transactions by Category")

    st.info("""
    Final review of all transactions grouped by category.
    Within each category, transactions are ordered by merchant for easy scanning.
    You can edit both category and merchant for individual transactions.
    """)

    df = st.session_state.transactions_df.copy()

    # Exclude bank transfers and internal transfers from this view
    df_review = df[(df['is_bank_transfer'] == False) & (df['is_internal_transfer'] == False)].copy()

    if len(df_review) == 0:
        st.warning("No transactions to review (all are bank transfers or internal transfers)")
        if st.button("Continue to Analysis"):
            st.session_state.stage = 'analysis'
            st.rerun()
        return

    # Date range filter at the top
    st.subheader("📅 Filter by Date Range")

    min_date = df_review['date'].min().date()
    max_date = df_review['date'].max().date()

    col1, col2, col3 = st.columns([2, 2, 1])

    with col1:
        start_date = st.date_input(
            "Start Date",
            value=min_date,
            min_value=min_date,
            max_value=max_date,
            key='category_review_start_date'
        )

    with col2:
        end_date = st.date_input(
            "End Date",
            value=max_date,
            min_value=min_date,
            max_value=max_date,
            key='category_review_end_date'
        )

    with col3:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("Reset Dates"):
            st.session_state.category_review_start_date = min_date
            st.session_state.category_review_end_date = max_date
            st.rerun()

    # Filter by date range
    df_filtered = df_review[
        (df_review['date'].dt.date >= start_date) &
        (df_review['date'].dt.date <= end_date)
    ].copy()

    if len(df_filtered) == 0:
        st.warning("No transactions in selected date range")
        return

    st.markdown(f"**Showing {len(df_filtered)} transactions**")
    st.markdown("---")

    # Get unique categories (excluding Uncategorized, put it last)
    categories = sorted([c for c in df_filtered['category'].unique() if c != 'Uncategorized'])
    if 'Uncategorized' in df_filtered['category'].unique():
        categories.append('Uncategorized')

    # Show transactions grouped by category
    all_edits = {}

    for category in categories:
        with st.expander(f"📂 {category} ({len(df_filtered[df_filtered['category'] == category])} transactions)", expanded=(category == categories[0])):
            category_df = df_filtered[df_filtered['category'] == category].copy()

            # Sort by merchant name within category
            category_df = category_df.sort_values('merchant')

            # Prepare display dataframe
            display_df = category_df[[
                'date', 'account', 'merchant', 'raw_description', 'amount', 'category'
            ]].copy()

            display_df['date'] = display_df['date'].dt.strftime('%Y-%m-%d')
            display_df['amount'] = display_df['amount'].round(2)

            # Get unique merchants for dropdown
            all_merchants = sorted(df_review['merchant'].unique())

            # Show editable table
            edited_df = st.data_editor(
                display_df,
                use_container_width=True,
                num_rows="fixed",
                column_config={
                    "date": st.column_config.TextColumn(
                        "Date",
                        disabled=True,
                        width="small"
                    ),
                    "account": st.column_config.TextColumn(
                        "Account",
                        disabled=True,
                        width="small"
                    ),
                    "merchant": st.column_config.SelectboxColumn(
                        "Merchant",
                        help="Edit merchant - type to search",
                        options=all_merchants,
                        width="medium",
                        required=True
                    ),
                    "raw_description": st.column_config.TextColumn(
                        "Raw Description",
                        disabled=True,
                        width="large"
                    ),
                    "amount": st.column_config.NumberColumn(
                        "Amount",
                        disabled=True,
                        width="small",
                        format="£%.2f"
                    ),
                    "category": st.column_config.SelectboxColumn(
                        "Category",
                        help="Edit category - type to search",
                        options=st.session_state.custom_categories,
                        width="medium",
                        required=True
                    )
                },
                hide_index=True,
                height=min(500, 35 * len(display_df) + 38),
                key=f'category_review_{category}'
            )

            # Store edits with original indices
            edited_df.index = category_df.index
            all_edits[category] = edited_df

    st.markdown("---")
    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("✅ Confirm & Continue to Analysis", type="primary"):
            # Apply all edits back to main dataframe
            for category, edited_df in all_edits.items():
                for idx, row in edited_df.iterrows():
                    df.at[idx, 'merchant'] = row['merchant']
                    df.at[idx, 'category'] = row['category']

            # Store updated transactions
            st.session_state.transactions_df = df

            # Move to analysis
            st.session_state.stage = 'analysis'
            st.rerun()


def show_analysis():
    """Show spending analysis and export options."""
    st.header("📊 Financial Analysis")

    # Get transactions and exclude internal transfers
    df_all = st.session_state.transactions_df
    df_no_transfers = df_all[df_all['is_internal_transfer'] == False].copy()

    # Separate expenses from core spending
    df_expenses = df_no_transfers[df_no_transfers['category'] == 'Expenses'].copy()
    df_core = df_no_transfers[df_no_transfers['category'] != 'Expenses'].copy()

    # Show summary of excluded transactions
    num_internal = len(df_all[df_all['is_internal_transfer'] == True])
    num_expenses = len(df_expenses)
    if num_internal > 0 or num_expenses > 0:
        exclusions = []
        if num_internal > 0:
            exclusions.append(f"{num_internal} internal transfers")
        if num_expenses > 0:
            exclusions.append(f"{num_expenses} business expenses (tracked separately)")
        st.info(f"ℹ️ {' and '.join(exclusions)} excluded from core spending analysis")

    # Date filtering
    st.subheader("📅 Date Range Filter")

    # Use df_core for date range (or all non-transfers if no core transactions)
    df_for_dates = df_core if len(df_core) > 0 else df_no_transfers
    min_date = df_for_dates['date'].min().date()
    max_date = df_for_dates['date'].max().date()

    col1, col2, col3 = st.columns([2, 2, 1])

    with col1:
        start_date = st.date_input(
            "Start Date",
            value=min_date,
            min_value=min_date,
            max_value=max_date,
            key='start_date_filter'
        )

    with col2:
        end_date = st.date_input(
            "End Date",
            value=max_date,
            min_value=min_date,
            max_value=max_date,
            key='end_date_filter'
        )

    with col3:
        st.markdown("<br>", unsafe_allow_html=True)  # Spacing
        if st.button("Reset Dates"):
            st.session_state.start_date_filter = min_date
            st.session_state.end_date_filter = max_date
            st.rerun()

    # Filter both core and expenses by date range
    df_core_filtered = df_core[
        (df_core['date'].dt.date >= start_date) &
        (df_core['date'].dt.date <= end_date)
    ].copy()

    df_expenses_filtered = df_expenses[
        (df_expenses['date'].dt.date >= start_date) &
        (df_expenses['date'].dt.date <= end_date)
    ].copy()

    if df_core_filtered.empty and df_expenses_filtered.empty:
        st.warning("No transactions found in the selected date range.")
        return

    st.caption(f"📅 Showing period from {start_date.strftime('%d %b %Y')} to {end_date.strftime('%d %b %Y')}")

    st.markdown("---")

    # Core spending analysis
    if not df_core_filtered.empty:
        analyzer = SpendingAnalyzer(df_core_filtered)
        summary = analyzer.get_summary_stats()

        st.subheader("💰 Core Income & Spending")
        st.caption("Excludes internal transfers and business expenses")

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric("Total Income", f"£{summary['total_inflows']:,.2f}")
        with col2:
            st.metric("Total Spending", f"£{summary['total_outflows']:,.2f}")
        with col3:
            st.metric("Net Cash Flow", f"£{summary['net_cashflow']:,.2f}")
        with col4:
            st.metric("Transactions", f"{summary['transaction_count']}")

    # Expense tracking
    if not df_expenses_filtered.empty:
        st.markdown("---")
        st.subheader("💼 Business Expenses")
        st.caption("Expenses that will be/have been reimbursed")

        expenses_paid = df_expenses_filtered[df_expenses_filtered['amount'] < 0]['amount'].sum()
        expenses_reimbursed = df_expenses_filtered[df_expenses_filtered['amount'] > 0]['amount'].sum()
        net_expenses = expenses_paid + expenses_reimbursed

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric("Expenses Paid Out", f"£{abs(expenses_paid):,.2f}", delta=None, delta_color="normal")
        with col2:
            st.metric("Expenses Reimbursed", f"£{expenses_reimbursed:,.2f}", delta=None, delta_color="inverse")
        with col3:
            st.metric("Net Unreimbursed", f"£{abs(net_expenses):,.2f}", delta=None, delta_color="off")
        with col4:
            st.metric("Expense Transactions", f"{len(df_expenses_filtered)}")

        if net_expenses < 0:
            st.warning(f"⚠️ You have £{abs(net_expenses):,.2f} in unreimbursed expenses to claim back")
        elif net_expenses > 0:
            st.info(f"ℹ️ You've received £{net_expenses:,.2f} more in reimbursements than expenses paid")
        else:
            st.success("✅ All expenses are fully reconciled")

    # Detailed analysis sections (only if we have core transactions)
    if not df_core_filtered.empty:
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
        # Export merchant category mapping
        category_csv = TransactionClassifier.export_mapping_to_csv(
            st.session_state.merchant_category_mapping
        )
        st.download_button(
            label="📥 Download Category Mapping",
            data=category_csv,
            file_name="category_mapping.csv",
            mime="text/csv",
            help="Save merchant → category defaults to reuse next time"
        )

    with col3:
        # Export all transactions (use original df, not filtered)
        transactions_csv = st.session_state.transactions_df.to_csv(index=False)
        st.download_button(
            label="📥 Download All Transactions",
            data=transactions_csv,
            file_name="transactions_analyzed.csv",
            mime="text/csv",
            help="All transactions with standardized merchants and categories (full dataset)"
        )


if __name__ == "__main__":
    main()
