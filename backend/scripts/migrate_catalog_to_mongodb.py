"""One-time migration for moving Chaska's initial product catalog into MongoDB."""

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path
import sys

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

PRODUCTS = [
    {
        "id": "bomboloni-classic", "name": "Classic Cream Bomboloni", "category": "bomboloni",
        "description": "Light, airy Italian doughnuts filled with velvety vanilla pastry cream. A timeless Florentine street food treasure.",
        "price": 180, "image": "https://images.unsplash.com/photo-1608894109526-ea487bf2c02c?w=600",
        "sizes": [{"name": "Single", "price": 180}, {"name": "Box of 6", "price": 950}, {"name": "Box of 12", "price": 1750}],
        "is_available": True, "featured": True,
    },
    {
        "id": "bomboloni-nutella", "name": "Nutella Bomboloni", "category": "bomboloni",
        "description": "Warm, pillowy bomboloni generously filled with rich Nutella chocolate-hazelnut spread.",
        "price": 200, "image": "https://images.unsplash.com/photo-1551106652-a5bcf0b59234?w=600",
        "sizes": [{"name": "Single", "price": 200}, {"name": "Box of 6", "price": 1050}, {"name": "Box of 12", "price": 1950}],
        "is_available": True, "featured": True,
    },
    {
        "id": "bomboloni-pistachio", "name": "Pistachio Bomboloni", "category": "bomboloni",
        "description": "Delicate bomboloni filled with authentic Sicilian pistachio cream, dusted with crushed pistachios.",
        "price": 220, "image": "https://images.unsplash.com/photo-1608894109526-ea487bf2c02c?w=600",
        "sizes": [{"name": "Single", "price": 220}, {"name": "Box of 6", "price": 1150}, {"name": "Box of 12", "price": 2150}],
        "is_available": True, "featured": False,
    },
    {
        "id": "bomboloni-lemon", "name": "Lemon Curd Bomboloni", "category": "bomboloni",
        "description": "Bright, zesty lemon curd filling in a sugar-dusted bomboloni. Perfect with afternoon espresso.",
        "price": 190, "image": "https://images.unsplash.com/photo-1763905145494-ba846f94dfd8?w=600",
        "sizes": [{"name": "Single", "price": 190}, {"name": "Box of 6", "price": 1000}, {"name": "Box of 12", "price": 1850}],
        "is_available": True, "featured": False,
    },
    {
        "id": "bomboloni-berry", "name": "Mixed Berry Bomboloni", "category": "bomboloni",
        "description": "Bursting with a medley of fresh strawberry, raspberry, and blueberry compote filling.",
        "price": 210, "image": "https://images.unsplash.com/photo-1769372742179-ed95c30f8b94?w=600",
        "sizes": [{"name": "Single", "price": 210}, {"name": "Box of 6", "price": 1100}, {"name": "Box of 12", "price": 2050}],
        "is_available": True, "featured": False,
    },
    {
        "id": "tiramisu-classic", "name": "Classic Tiramisu", "category": "tiramisu",
        "description": "The quintessential Italian dessert. Layers of espresso-soaked ladyfingers, mascarpone cream, and cocoa.",
        "price": 450, "image": "https://images.unsplash.com/photo-1714385905983-6f8e06fffae1?w=600",
        "sizes": [{"name": "Individual", "price": 450}, {"name": "Half Kg", "price": 850}, {"name": "1 Kg", "price": 1500}],
        "is_available": True, "featured": True,
    },
    {
        "id": "tiramisu-pistachio", "name": "Pistachio Tiramisu", "category": "tiramisu",
        "description": "A Sicilian twist on the classic. Pistachio cream layered with delicate sponge and white chocolate shavings.",
        "price": 520, "image": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600",
        "sizes": [{"name": "Individual", "price": 520}, {"name": "Half Kg", "price": 950}, {"name": "1 Kg", "price": 1700}],
        "is_available": True, "featured": True,
    },
    {
        "id": "tiramisu-strawberry", "name": "Strawberry Tiramisu", "category": "tiramisu",
        "description": "Fresh strawberries paired with mascarpone cream and a hint of amaretto liqueur.",
        "price": 480, "image": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600",
        "sizes": [{"name": "Individual", "price": 480}, {"name": "Half Kg", "price": 900}, {"name": "1 Kg", "price": 1600}],
        "is_available": True, "featured": False,
    },
    {
        "id": "tiramisu-matcha", "name": "Matcha Tiramisu", "category": "tiramisu",
        "description": "Japanese-Italian fusion. Premium matcha green tea layered with mascarpone and white chocolate.",
        "price": 500, "image": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600",
        "sizes": [{"name": "Individual", "price": 500}, {"name": "Half Kg", "price": 920}, {"name": "1 Kg", "price": 1650}],
        "is_available": True, "featured": False,
    },
    {
        "id": "tiramisu-espresso", "name": "Double Espresso Tiramisu", "category": "tiramisu",
        "description": "For the coffee lover. Extra bold espresso with dark chocolate and mascarpone layers.",
        "price": 470, "image": "https://images.unsplash.com/photo-1542124948-dc391252a940?w=600",
        "sizes": [{"name": "Individual", "price": 470}, {"name": "Half Kg", "price": 880}, {"name": "1 Kg", "price": 1550}],
        "is_available": True, "featured": False,
    },
]

REVIEWS = [
    {"id": "rev1", "customer_name": "Maria Rossi", "rating": 5, "comment": "The best bomboloni outside of Florence! The pistachio cream is heavenly.", "product_id": "bomboloni-pistachio", "status": "approved", "source": "sample"},
    {"id": "rev2", "customer_name": "Raj Patel", "rating": 5, "comment": "Their classic tiramisu is absolutely divine. Takes me back to Rome every time!", "product_id": "tiramisu-classic", "status": "approved", "source": "sample"},
    {"id": "rev3", "customer_name": "Sophie Chen", "rating": 4, "comment": "Ordered a box of Nutella bomboloni for a party. Everyone loved them!", "product_id": "bomboloni-nutella", "status": "approved", "source": "sample"},
    {"id": "rev4", "customer_name": "Arjun Mehta", "rating": 5, "comment": "The matcha tiramisu is a unique fusion that actually works brilliantly. Highly recommend.", "product_id": "tiramisu-matcha", "status": "approved", "source": "sample"},
    {"id": "rev5", "customer_name": "Priya Sharma", "rating": 5, "comment": "Perfect delivery, beautifully packed. The lemon curd bomboloni were fresh and tangy!", "product_id": "bomboloni-lemon", "status": "approved", "source": "sample"},
]


def migrate(overwrite: bool) -> None:
    mongodb_uri = os.environ.get("MONGODB_URI")
    database_name = os.environ.get("DB_NAME")
    if not mongodb_uri or not database_name:
        raise RuntimeError("MONGODB_URI and DB_NAME must be configured")

    client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=10000)
    try:
        client.admin.command("ping")
        database = client[database_name]
        products = database.products
        reviews = database.reviews
        now = datetime.now(timezone.utc)
        operations = []
        for product in PRODUCTS:
            if overwrite:
                update = {"$set": {**product, "updated_at": now}, "$setOnInsert": {"created_at": now}}
            else:
                update = {"$setOnInsert": {**product, "created_at": now}}
            operations.append(UpdateOne({"id": product["id"]}, update, upsert=True))

        result = products.bulk_write(operations, ordered=False)
        products.create_index("id", unique=True)
        review_operations = []
        for review in REVIEWS:
            if overwrite:
                update = {"$set": {**review, "updated_at": now}, "$setOnInsert": {"created_at": now}}
            else:
                insert_only = {
                    key: value
                    for key, value in review.items()
                    if key not in {"status", "source"}
                }
                update = {
                    "$set": {"status": review["status"], "source": review["source"]},
                    "$setOnInsert": {**insert_only, "created_at": now},
                }
            review_operations.append(UpdateOne({"id": review["id"]}, update, upsert=True))
        review_result = reviews.bulk_write(review_operations, ordered=False)
        reviews.create_index("id", unique=True)
        reviews.create_index([("status", 1), ("created_at", -1)])
        print(
            f"Catalog migration complete: products matched={result.matched_count}, "
            f"inserted={result.upserted_count}, total={products.count_documents({})}; "
            f"reviews matched={review_result.matched_count}, inserted={review_result.upserted_count}, "
            f"total={reviews.count_documents({})}, "
            f"approved={reviews.count_documents({'status': 'approved'})}"
        )
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace matching MongoDB product fields with the migration catalog values.",
    )
    migrate(parser.parse_args().overwrite)
