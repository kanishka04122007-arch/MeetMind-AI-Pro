import joblib

model = joblib.load("models/model.pkl")
vectorizer = joblib.load("models/vectorizer.pkl")

sample = [
    "I am unable to login into my account and password reset is not working"
]

sample_vector = vectorizer.transform(sample)

prediction = model.predict(sample_vector)

print("Predicted Category:", prediction[0])
