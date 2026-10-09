import pandas as pd
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB

# Load both datasets
df1 = pd.read_csv("datasets/team_meeting.csv")
df2 = pd.read_csv("datasets/meeting_dataset.csv")

# Merge datasets
df = pd.concat([df1, df2], ignore_index=True)

# Remove empty rows
df = df.dropna()

# Remove duplicate rows
df = df.drop_duplicates()

print("Total Records:", len(df))
print(df["label"].value_counts())

# Features and labels
X = df["text"]
y = df["label"]

# Convert text into vectors
vectorizer = TfidfVectorizer()

X_vector = vectorizer.fit_transform(X)

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X_vector,
    y,
    test_size=0.2,
    random_state=42
)

# Train
model = MultinomialNB()

model.fit(X_train, y_train)

# Accuracy
accuracy = model.score(X_test, y_test)

print(f"Accuracy: {accuracy:.2f}")

# Save model
joblib.dump(model, "models/model.pkl")
joblib.dump(vectorizer, "models/vectorizer.pkl")

print("Training Completed")
print("Model Saved")