from pathlib import Path

from clinical_model import train_and_save_model

if __name__ == "__main__":
    target = Path(__file__).with_name("model.joblib")
    train_and_save_model(target)
    print(f"Model trained and saved to {target}")
