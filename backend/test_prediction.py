import joblib

model = joblib.load("models/model.pkl")
vectorizer = joblib.load("models/vectorizer.pkl")

while True:

    text = input("Enter Meeting Text: ")

    if text.lower() == "exit":
        break

    vector = vectorizer.transform([text])

    prediction = model.predict(vector)

    print("Predicted Label:", prediction[0])