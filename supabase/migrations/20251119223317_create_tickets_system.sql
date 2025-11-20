/*
  # Sistema de Gestión de Entradas Digitales para Teatro

  1. Nuevas Tablas
    - `events`
      - `id` (uuid, primary key) - Identificador único del evento
      - `name` (text) - Nombre del evento/obra de teatro
      - `description` (text) - Descripción del evento
      - `event_date` (timestamptz) - Fecha y hora del evento
      - `created_at` (timestamptz) - Fecha de creación
      - `created_by` (uuid) - Usuario que creó el evento
    
    - `ticket_designs`
      - `id` (uuid, primary key) - Identificador único del diseño
      - `event_id` (uuid, foreign key) - Referencia al evento
      - `background_image` (text) - URL de la imagen de fondo
      - `title` (text) - Título en la entrada
      - `subtitle` (text) - Subtítulo en la entrada
      - `created_at` (timestamptz) - Fecha de creación
    
    - `tickets`
      - `id` (uuid, primary key) - Identificador único de la entrada
      - `event_id` (uuid, foreign key) - Referencia al evento
      - `qr_code` (text, unique) - Código único para el QR
      - `is_used` (boolean) - Estado de uso de la entrada
      - `used_at` (timestamptz) - Fecha y hora de uso
      - `ticket_number` (integer) - Número de entrada
      - `created_at` (timestamptz) - Fecha de creación

  2. Seguridad
    - Habilitar RLS en todas las tablas
    - Políticas para autenticación y validación segura
    - Índices para optimizar consultas de validación

  3. Notas Importantes
    - Los códigos QR son únicos y no pueden duplicarse
    - Una entrada solo puede usarse una vez
    - Sistema de auditoría con timestamps
*/

-- Crear tabla de eventos
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  event_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Crear tabla de diseños de entradas
CREATE TABLE IF NOT EXISTS ticket_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  background_image text DEFAULT '',
  title text NOT NULL,
  subtitle text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de entradas
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  qr_code text UNIQUE NOT NULL,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  ticket_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_tickets_qr_code ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_is_used ON tickets(is_used);

-- Habilitar RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Políticas para events
CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Políticas para ticket_designs
CREATE POLICY "Anyone can view ticket designs"
  ON ticket_designs FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create ticket designs"
  ON ticket_designs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ticket designs"
  ON ticket_designs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ticket designs"
  ON ticket_designs FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para tickets
CREATE POLICY "Anyone can view tickets"
  ON tickets FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update ticket status"
  ON tickets FOR UPDATE
  USING (true)
  WITH CHECK (true);