import re

def is_valid_luhn(card_number: str) -> bool:
    """
    Checks if a string of digits is a valid credit card number using Luhn's algorithm.
    """
    digits = [int(d) for d in card_number if d.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, digit in enumerate(reverse_digits):
        if i % 2 == 1:
            double_digit = digit * 2
            if double_digit > 9:
                double_digit -= 9
            checksum += double_digit
        else:
            checksum += digit
    return checksum % 10 == 0

def is_valid_aba(routing_number: str) -> bool:
    """
    Checks if a 9-digit string is a valid ABA routing transit number (RTN) using the standard checksum formula.
    """
    if not re.match(r'^\d{9}$', routing_number):
        return False
    d = [int(x) for x in routing_number]
    checksum = (
        3 * (d[0] + d[3] + d[6]) +
        7 * (d[1] + d[4] + d[7]) +
        (d[2] + d[5] + d[8])
    )
    return checksum % 10 == 0

def check_compliance(text: str):
    """
    Enterprise Compliance Agent
    Checks for PII (Personally Identifiable Information) and security policy violations.
    Enhanced to handle banking PII: IBANs, Credit Cards (Luhn checks), and Routing Numbers.
    """
    violations = []
    masked_text = text
    
    # 1. IBAN check and mask
    iban_pattern = r'\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b'
    iban_candidates = re.finditer(iban_pattern, masked_text, re.IGNORECASE)
    for match in iban_candidates:
        candidate = match.group(0)
        violations.append("iban")
        masked_text = masked_text.replace(candidate, "[MASKED_IBAN]")
        
    # 2. Credit Card check with Luhn algorithm validation (matches sequences of 13-19 digits with spaces/dashes)
    cc_candidates = re.finditer(r'\b(?:\d[ -]*?){13,19}\b', masked_text)
    for match in cc_candidates:
        candidate = match.group(0)
        cleaned = re.sub(r'\D', '', candidate)
        if 13 <= len(cleaned) <= 19 and is_valid_luhn(cleaned):
            violations.append("credit_card")
            masked_text = masked_text.replace(candidate, "[MASKED_CC]")
            
    # 3. ABA Routing Number check with checksum validation
    routing_candidates = re.finditer(r'\b\d{9}\b', masked_text)
    for match in routing_candidates:
        candidate = match.group(0)
        if is_valid_aba(candidate):
            violations.append("aba_routing")
            masked_text = masked_text.replace(candidate, "[MASKED_ROUTING]")
            
    # 4. Standard pattern checks on masked text (email, phone, ssn)
    email_pattern = r'\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b'
    email_matches = list(re.finditer(email_pattern, masked_text))
    if email_matches:
        violations.append("email")
        for match in email_matches:
            masked_text = masked_text.replace(match.group(0), "[MASKED_EMAIL]")

    ssn_pattern = r'\b\d{3}-\d{2}-\d{4}\b'
    ssn_matches = list(re.finditer(ssn_pattern, masked_text))
    if ssn_matches:
        violations.append("ssn")
        for match in ssn_matches:
            masked_text = masked_text.replace(match.group(0), "[MASKED_SSN]")

    # Check phone number: matches BD phone (+8801XXXXXXXXX / 01XXXXXXXXX) and standard formatted international phones
    # Negative lookbehind/lookahead to prevent false positives on DOIs, decimals, years, and URL paths
    bd_phone_pattern = r'(?<![\d\./])(?:\+?880|0)1[3-9]\d{8}(?![\d\./])'
    intl_phone_pattern = r'(?<![\d\./])(?:\+\d{1,3}[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?![\d\./])'

    found_phone = False
    for pat in [bd_phone_pattern, intl_phone_pattern]:
        matches = list(re.finditer(pat, masked_text))
        if matches:
            found_phone = True
            for match in matches:
                masked_text = masked_text.replace(match.group(0), "[MASKED_PHONE]")

    if found_phone:
        violations.append("phone")

    return {
        "compliant": len(violations) == 0,
        "violations": list(set(violations)),
        "masked_text": masked_text
    }
