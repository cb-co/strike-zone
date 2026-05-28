-- Enable Row-Level Security on all user-data tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tradestation_tokens ENABLE ROW LEVEL SECURITY;

-- accounts
CREATE POLICY "accounts_owner" ON accounts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- instruments
CREATE POLICY "instruments_owner" ON instruments
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- setups
CREATE POLICY "setups_owner" ON setups
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trades
CREATE POLICY "trades_owner" ON trades
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trade_setups (join table — access allowed when the linked trade belongs to the user)
CREATE POLICY "trade_setups_owner" ON trade_setups
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_setups.trade_id
        AND trades.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_setups.trade_id
        AND trades.user_id = auth.uid()
    )
  );

-- goals
CREATE POLICY "goals_owner" ON goals
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- monthly_snapshots
CREATE POLICY "monthly_snapshots_owner" ON monthly_snapshots
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- cash_activities
CREATE POLICY "cash_activities_owner" ON cash_activities
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tradestation_tokens
CREATE POLICY "tradestation_tokens_owner" ON tradestation_tokens
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
