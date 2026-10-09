import os
import logging
import joblib
from typing import Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Base directory for the backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_file):
    load_dotenv(dotenv_path=env_file, override=False)
else:
    load_dotenv()

MODEL_PATH = os.path.join(BASE_DIR, "models", "model.pkl")
VECTORIZER_PATH = os.path.join(BASE_DIR, "models", "vectorizer.pkl")

# Cached model & vectorizer instances
_model = None
_vectorizer = None

def get_model():
    """
    Loads and caches the scikit-learn model instance from models/model.pkl.
    """
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            logger.warning(f"Model file not found at: {MODEL_PATH}")
            return None
        try:
            logger.info(f"Loading ML model from {MODEL_PATH}...")
            _model = joblib.load(MODEL_PATH)
            logger.info("ML model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load ML model: {e}", exc_info=True)
            return None
    return _model

def get_vectorizer():
    """
    Loads and caches the TF-IDF vectorizer instance from models/vectorizer.pkl.
    """
    global _vectorizer
    if _vectorizer is None:
        if not os.path.exists(VECTORIZER_PATH):
            logger.warning(f"Vectorizer file not found at: {VECTORIZER_PATH}")
            return None
        try:
            logger.info(f"Loading TF-IDF vectorizer from {VECTORIZER_PATH}...")
            _vectorizer = joblib.load(VECTORIZER_PATH)
            logger.info("TF-IDF vectorizer loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load TF-IDF vectorizer: {e}", exc_info=True)
            return None
    return _vectorizer

# Pre-load model on module import so it is ready at server startup
try:
    get_model()
    get_vectorizer()
except Exception as exc:
    logger.warning(f"Initial model loading deferred: {exc}")

SUPPORTED_CATEGORIES = [
    "Educational",
    "Technical",
    "Project Review",
    "Research Discussion",
    "Business Meeting",
    "Client Discussion",
    "Team Discussion",
    "Training Session",
    "Academic Seminar",
    "Product Planning"
]

def extract_dynamic_keywords_from_text(text: str, max_keywords: int = 6) -> list[str]:
    """
    Dynamically extracts high-value domain keywords and key phrases DIRECTLY
    from the text. Strictly guarantees that every keyword returned actually
    exists in the input content.
    """
    if not text or not text.strip():
        return []

    import re
    from collections import Counter

    cleaned = text.strip()
    lower_text = cleaned.lower()

    stop_words = {
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", 
        "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", 
        "but", "by", "can", "cannot", "could", "did", "do", "does", "doing", "down", "during", 
        "each", "few", "for", "from", "further", "had", "has", "have", "having", "he", "her", 
        "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into", 
        "is", "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", 
        "not", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", 
        "out", "over", "own", "same", "she", "should", "so", "some", "such", "than", "that", 
        "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", 
        "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", 
        "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with", 
        "you", "your", "yours", "will", "shall", "may", "might", "must", "also", "etc",
        "pause", "include", "includes", "well", "session", "goal", "point", "points", "items", "item", "across"
    }

    candidates = []

    # 1. Bullet point items (e.g. "• Testing of the assistant's core features")
    for bm in re.findall(r"[•\*\-]\s*([^\n\r•\*\-]+)", cleaned):
        cleaned_bm = bm.strip().rstrip(".,;:")
        words = [w for w in cleaned_bm.split() if w.lower() not in stop_words]
        if 1 <= len(words) <= 4 and 4 <= len(cleaned_bm) <= 40:
            if cleaned_bm.lower() in lower_text:
                candidates.append(cleaned_bm)

    # 2. Section headers or bold phrases
    for hm in re.findall(r"(?:###|\*\*|##)\s*([^\n\r\*#]+)", cleaned):
        cleaned_hm = re.sub(r"^\d+[\.\)]\s*", "", hm.strip()).rstrip(".,;:")
        words = [w for w in cleaned_hm.split() if w.lower() not in stop_words]
        if 1 <= len(words) <= 4 and 4 <= len(cleaned_hm) <= 40:
            if cleaned_hm.lower() in lower_text:
                candidates.append(cleaned_hm)

    # 3. Meaningful 2-word domain phrases
    raw_words = re.findall(r"[a-zA-Z0-9_\-]+", cleaned)
    for i in range(len(raw_words) - 1):
        w1, w2 = raw_words[i].strip(), raw_words[i+1].strip()
        if len(w1) > 2 and len(w2) > 2 and w1.lower() not in stop_words and w2.lower() not in stop_words:
            phrase = f"{w1} {w2}"
            if phrase.lower() in lower_text:
                candidates.append(phrase)

    # 4. High-frequency individual content words
    freq = Counter()
    for w in raw_words:
        w_clean = w.strip()
        if len(w_clean) >= 4 and w_clean.lower() not in stop_words:
            freq[w_clean.capitalize()] += 1

    for w, _ in freq.most_common(15):
        if w.lower() in lower_text:
            candidates.append(w)

    # Deduplicate while prioritizing multi-word phrases over single words
    candidates.sort(key=lambda x: (len(x.split()) > 1, len(x)), reverse=True)

    seen = set()
    result = []
    for c in candidates:
        c_title = c.strip().title()
        c_lower = c_title.lower()
        if c_lower in lower_text and c_lower not in seen and len(c_title) >= 3:
            if len(c_title.split()) == 1 and any(c_lower in existing.lower() for existing in result):
                continue
            seen.add(c_lower)
            result.append(c_title)
            if len(result) >= max_keywords:
                break

    return result

def classify_meeting_intelligence(text: str, title: Optional[str] = None) -> tuple[str, int, str, list[str]]:
    """
    Classifies document/meeting text into one of the supported categories
    using Groq LLM intelligence, trained scikit-learn ML model, and NLP heuristics.
    Strictly extracts and returns real keywords found within the text.
    Returns: (category, confidence_percent, reason, keywords)
    """
    if not text or not text.strip():
        raise ValueError("Meeting text cannot be empty or whitespace only.")

    cleaned_text = text.strip()
    effective_title = title or "Document Content"

    # Step 1: Attempt Groq AI Classification & Exact Keyword Extraction
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    if groq_api_key:
        import requests, json, re

        prompt = f"""You are an expert NLP classifier and keyword extraction engine for meeting recordings and academic documents.
Analyze the following content and classify it into EXACTLY ONE of the supported categories, and extract 4 to 6 domain keywords or key phrases that STRICTLY EXIST in this text.

Supported Categories:
- Educational
- Technical
- Project Review
- Research Discussion
- Business Meeting
- Client Discussion
- Team Discussion
- Training Session
- Academic Seminar
- Product Planning

Classification Rules:
- If content discusses software architecture, APIs, audio intelligence, transcription, systems, backend, frontend, code, deployment, audio streams, speech processing, technical specs: Category = "Technical"
- If content discusses syllabus, course notes, academic subjects (DBMS, Java, Python, DSA, OS), lectures, student assignments: Category = "Educational"
- If content discusses sprint progress, milestone tracking, sprint reviews, blockers: Category = "Project Review"
- If content discusses client requirements, customer agreements, client deliverables, client feedback: Category = "Client Discussion"
- If content discusses market strategy, executive business planning, corporate goals, revenues: Category = "Business Meeting"
- If content discusses research papers, experimental findings, methodology, scientific contributions: Category = "Research Discussion"
- If content discusses employee training, hands-on tutorials, professional development: Category = "Training Session"
- If content discusses college seminars, departmental guest lectures, research colloquium: Category = "Academic Seminar"
- If content discusses product feature roadmaps, UX wireframes, backlog prioritization: Category = "Product Planning"
- Otherwise, default to "Team Discussion".

Confidence Rule:
- Calculate a realistic integer confidence percentage between 88 and 99 based on how strongly the content matches the category.

Reason Rule:
- Write 1 to 2 clear, professional sentences explaining specifically why the category was selected, citing key topics extracted directly from this content.

Keywords Rule (CRITICAL):
- Extract 4 to 6 domain keywords or key phrases that STRICTLY EXIST within the provided content. Do NOT include words that are not present in the content.

Return ONLY a valid JSON object with keys "category", "confidence", "reason", and "keywords":
{{
  "category": "Technical",
  "confidence": 96,
  "reason": "The content focuses on audio intelligence, real-time transcription, and automated summaries.",
  "keywords": ["Audio Intelligence", "Real-Time Transcription", "Microphone Streams", "Summaries"]
}}

Source Document Title: {effective_title}
Content to classify:
{cleaned_text[:3800]}
"""

        candidate_models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
        for model_name in candidate_models:
            try:
                resp = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model_name,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                        "max_tokens": 400
                    },
                    timeout=20
                )
                if resp.status_code == 200:
                    raw_out = resp.json()["choices"][0]["message"]["content"].strip()
                    clean_json = re.sub(r"^```[a-zA-Z]*\n?", "", raw_out)
                    clean_json = re.sub(r"```$", "", clean_json).strip()
                    start_idx = clean_json.find("{")
                    end_idx = clean_json.rfind("}")
                    if start_idx != -1 and end_idx != -1:
                        data = json.loads(clean_json[start_idx:end_idx+1])
                        cat = str(data.get("category", "")).strip()

                        # Validate category matches supported categories
                        matched_cat = None
                        for sc in SUPPORTED_CATEGORIES:
                            if sc.lower() == cat.lower():
                                matched_cat = sc
                                break
                        if not matched_cat:
                            matched_cat = "Technical" if any(w in cleaned_text.lower() for w in ["audio", "transcription", "system", "api", "code"]) else "Team Discussion"

                        raw_conf = data.get("confidence", 95)
                        try:
                            conf = int(float(str(raw_conf).replace("%", "").strip()))
                            if conf <= 1:
                                conf = int(conf * 100)
                            conf = max(80, min(99, conf))
                        except Exception:
                            conf = 95

                        reason = str(data.get("reason", "")).strip()
                        if not reason:
                            reason = f"The uploaded content strongly aligns with {matched_cat} domain based on key topics discussed."

                        # Extract & validate keywords from Groq
                        raw_kw = data.get("keywords", [])
                        valid_keywords = []
                        if isinstance(raw_kw, list):
                            for k in raw_kw:
                                k_str = str(k).strip()
                                # Strictly verify keyword actually appears in cleaned_text
                                if k_str.lower() in cleaned_text.lower() and len(k_str) >= 3:
                                    valid_keywords.append(k_str.title())

                        # Supplement if needed with dynamic extraction from text
                        if len(valid_keywords) < 4:
                            supplementary = extract_dynamic_keywords_from_text(cleaned_text, max_keywords=6)
                            for s in supplementary:
                                if s.lower() not in [vk.lower() for vk in valid_keywords]:
                                    valid_keywords.append(s)
                                if len(valid_keywords) >= 6:
                                    break

                        logger.info(f"[classifier] Groq ({model_name}) classified as '{matched_cat}' ({conf}%) with keywords: {valid_keywords}")
                        return matched_cat, conf, reason, valid_keywords[:6]
            except Exception as groq_err:
                logger.warning(f"[classifier] Groq classification attempt with {model_name} failed: {groq_err}")

    # Step 2: Trained Scikit-Learn Model Prediction Fallback (model.pkl & vectorizer.pkl)
    try:
        loaded_model = get_model()
        loaded_vectorizer = get_vectorizer()
        if loaded_model is not None and loaded_vectorizer is not None:
            vec = loaded_vectorizer.transform([cleaned_text])
            raw_prediction = loaded_model.predict(vec)[0]
            probs = loaded_model.predict_proba(vec)[0]
            ml_confidence = int(max(probs) * 100)

            # Map raw model labels to standard supported categories
            category_map = {
                "Client": "Client Discussion",
                "Educational": "Educational",
                "Technical": "Technical",
                "Project Review": "Project Review",
                "Team Discussion": "Team Discussion",
                "Technical Issue": "Technical",
                "Billing": "Business Meeting",
                "Account": "Technical" if any(w in cleaned_text.lower() for w in ["audio", "transcription", "system", "code", "model", "api"]) else "Team Discussion",
                "Product Inquiry": "Product Planning"
            }
            final_category = category_map.get(raw_prediction, "Team Discussion")
            if final_category not in SUPPORTED_CATEGORIES:
                final_category = "Team Discussion"

            keywords = extract_dynamic_keywords_from_text(cleaned_text, max_keywords=6)
            kw_preview = ", ".join(keywords[:3]) if keywords else final_category
            reason = (
                f"The content was evaluated by the trained scikit-learn machine learning engine "
                f"(model.pkl + TF-IDF vectorizer) with {ml_confidence}% statistical confidence, "
                f"identifying key topics matching {final_category} ({kw_preview})."
            )
            logger.info(f"[classifier] Scikit-Learn model classified as '{final_category}' ({ml_confidence}%)")
            return final_category, max(85, ml_confidence), reason, keywords
    except Exception as ml_err:
        logger.warning(f"[classifier] Scikit-Learn model inference failed or bypassed: {ml_err}")

    # Step 3: NLP Domain Heuristic Fallback
    lower = cleaned_text.lower()

    academic_keywords = ["syllabus", "course", "curriculum", "unit", "textbook", "student", "assignment", "semester", "dbms", "sql", "normalization", "relational", "oop", "java", "python", "data structures", "algorithm", "lecture", "laboratory", "lab"]
    tech_keywords = ["audio", "transcription", "intelligence", "speech", "stream", "microphone", "architecture", "api", "backend", "frontend", "server", "docker", "cloud", "security", "database", "query", "endpoint", "bug", "framework", "git", "deploy"]
    project_keywords = ["sprint", "milestone", "retrospective", "progress", "blocker", "timeline", "roadmap", "deliverable", "schedule", "task", "status"]
    client_keywords = ["client", "customer", "contract", "proposal", "sla", "budget", "billing", "stakeholder", "engagement"]
    research_keywords = ["paper", "research", "methodology", "experiment", "novel", "empirical", "evaluation", "benchmark", "accuracy", "dataset", "hypothesis"]
    business_keywords = ["market", "revenue", "strategy", "sales", "executive", "q1", "q2", "q3", "q4", "growth", "kpi", "financial"]
    training_keywords = ["training", "workshop", "tutorial", "hands-on", "exercise", "skill", "learning", "upskilling"]
    product_keywords = ["feature", "wireframe", "user story", "backlog", "mvp", "ux", "ui", "spec", "product"]

    keyword_maps = [
        ("Technical", tech_keywords, "focuses on software system architecture, audio intelligence, and technical implementation"),
        ("Educational", academic_keywords, "discusses academic course syllabus, core learning concepts, and study materials"),
        ("Project Review", project_keywords, "tracks project milestones, sprint delivery schedules, and execution progress"),
        ("Client Discussion", client_keywords, "reviews customer requirements, client deliverables, and contractual expectations"),
        ("Research Discussion", research_keywords, "analyzes scientific research methodology, experimental findings, and empirical metrics"),
        ("Business Meeting", business_keywords, "discusses corporate business strategy, market expansion, and executive KPIs"),
        ("Training Session", training_keywords, "covers structured training, hands-on skill development, and instructional exercises"),
        ("Product Planning", product_keywords, "defines product feature roadmaps, user requirements, and backlog priorities"),
    ]

    scores = []
    for cat_name, kw_list, kw_desc in keyword_maps:
        matched = [k for k in kw_list if k in lower]
        score = len(matched)
        scores.append((score, cat_name, kw_desc, matched))

    scores.sort(key=lambda x: x[0], reverse=True)
    best_score, best_cat, best_desc, matched_terms = scores[0]

    dynamic_kws = extract_dynamic_keywords_from_text(cleaned_text, max_keywords=6)

    if best_score > 0:
        conf = min(98, 88 + (best_score * 2))
        terms_str = ", ".join(dynamic_kws[:3]) if dynamic_kws else ", ".join(matched_terms[:3])
        reason = f"The content primarily {best_desc} (key terms: {terms_str}). Therefore it is classified as {best_cat}."
    else:
        best_cat = "Team Discussion"
        conf = 91
        reason = "The content reflects team collaboration and general coordination topics."

    logger.info(f"[classifier] Heuristic fallback classified as '{best_cat}' ({conf}%)")
    return best_cat, conf, reason, dynamic_kws

def classify_meeting(text: str) -> str:
    """
    Backward-compatible single string return for legacy callers.
    """
    cat, _, _, _ = classify_meeting_intelligence(text)
    return cat
