-- Enable RLS on all restaurant-scoped tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Server sets: SET LOCAL app.restaurant_id = 'uuid-here' before each query
CREATE POLICY restaurant_isolation ON categories
  USING (restaurant_id::text = current_setting('app.restaurant_id', true));

CREATE POLICY restaurant_isolation ON menu_items
  USING (restaurant_id::text = current_setting('app.restaurant_id', true));

CREATE POLICY restaurant_isolation ON tables
  USING (restaurant_id::text = current_setting('app.restaurant_id', true));

CREATE POLICY restaurant_isolation ON orders
  USING (restaurant_id::text = current_setting('app.restaurant_id', true));

CREATE POLICY restaurant_isolation ON ingredients
  USING (restaurant_id::text = current_setting('app.restaurant_id', true));

CREATE POLICY restaurant_isolation ON inventory_transactions
  USING (restaurant_id::text = current_setting('app.restaurant_id', true));
