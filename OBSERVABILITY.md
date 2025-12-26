# OpenTelemetry and Column-Level Lineage Guide

This guide explains how to use the OpenTelemetry tracing and column-level lineage features in the Spark Performance Visual App.

## Features

### ✅ OpenTelemetry Tracing
- **Automatic instrumentation** of React app interactions
- **Distributed tracing** with span context propagation
- **Multiple exporters**:
  - In-memory exporter for real-time UI visualization
  - OTLP HTTP exporter for Grafana/Tempo
  - Jaeger exporter (optional)
- **Rich span attributes** including mission ID, knobs state, and performance metrics

### ✅ Column-Level Lineage
- **Automatic column tracking** across Spark-like operations
- **Transformation tracking** (joins, aggregations, projections, filters)
- **Visual lineage graph** with column details
- **Column-level impact analysis** showing how knobs affect specific columns

## Quick Start

### Run the full stack with Docker Compose

1. Build and start the React app with the observability services:
   ```bash
   docker compose up --build app tempo grafana jaeger prometheus
   ```
   - App UI: http://localhost:4173
   - Jaeger: http://localhost:16686
   - Grafana: http://localhost:3001 (Tempo datasouce is pre-provisioned)
2. Open the app at http://localhost:4173 and click **Start mission**.
3. Scroll to the **Observability Panel** and confirm:
   - **Telemetry Traces** tab shows spans for UI interactions (trace ID links open in Grafana/Tempo).
   - **App Lineage** tab renders column-level lineage for the current mission.
4. (Optional) Cross-check the exported traces in:
   - Grafana **Explore → Tempo** using `spark-performance-react-app` or TraceQL queries (e.g., `{app.mission != ""}`).
   - Jaeger by searching for service `spark-performance-react-app`.

Build-time OTLP settings are provided as Docker build args and default to the in-network Tempo receiver:

```yaml
app:
  build:
    args:
      VITE_ENABLE_OTLP: "true"
      VITE_OTLP_ENDPOINT: http://tempo:4318/v1/traces
      VITE_ENABLE_JAEGER: "false"
```

Override these values when running `docker compose build` if you need to point the app at a different collector.

### 1. Start Observability Stack

The project includes a complete observability stack with Docker Compose:

```bash
# Start all services (Jaeger, Tempo, Grafana, Prometheus)
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f
```

**Services and Ports:**
- **Jaeger UI**: http://localhost:16686 - View traces in Jaeger
- **Grafana**: http://localhost:3001 - Dashboards and Tempo traces
- **Tempo**: http://localhost:3200 - Trace backend
- **Prometheus**: http://localhost:9090 - Metrics (optional)

### 2. Configure the React App

Update `.env` file to enable trace export:

```env
# Enable OTLP exporter to send traces to Grafana/Tempo
VITE_ENABLE_OTLP=true
VITE_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# Optional: Enable Jaeger exporter
VITE_ENABLE_JAEGER=false
VITE_JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

### 3. Start the React App

```bash
npm run dev
```

The app will start at http://localhost:5173 and automatically begin sending traces to the configured backends.

### 4. View Traces

#### Option 1: In-App Viewer
- Open the React app
- Navigate to the **Observability Panel**
- View the **OpenTelemetry Traces** tab for real-time trace visualization
- Expand spans to see attributes, events, and timing

#### Option 2: Jaeger UI
1. Open http://localhost:16686
2. Select service: `spark-performance-react-app`
3. Click "Find Traces"
4. View detailed trace waterfall diagrams

#### Option 3: Grafana + Tempo
1. Open http://localhost:3001
2. Navigate to **Explore** (compass icon)
3. Select **Tempo** datasource
4. Use **Search** or **TraceQL** to query traces
5. View traces with full context and links to metrics

### 5. View Column Lineage

#### In-App Lineage Viewer
- Open the React app
- Navigate to the **Observability Panel**
- Select the **Lineage Graph** tab
- Click on any node to expand and view columns
- Columns show:
  - Column name and data type
  - Source columns (where data came from)
  - Transformation applied (e.g., "SUM(amount)", "JOIN key")

## Architecture

### OpenTelemetry Setup

```
┌──────────────────┐
│   React App      │
│  (Instrumented)  │
└────────┬─────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         v                                 v
┌─────────────────┐              ┌──────────────────┐
│  In-Memory      │              │  OTLP Exporter   │
│  Exporter       │              │  (Batch)         │
│  (UI Viewer)    │              └────────┬─────────┘
└─────────────────┘                       │
                                          │
                          ┌───────────────┴────────────┐
                          │                            │
                          v                            v
                  ┌──────────────┐          ┌──────────────┐
                  │   Jaeger     │          │    Tempo     │
                  │  (Optional)  │          │  (Grafana)   │
                  └──────────────┘          └──────────────┘
```

### Column Lineage Flow

```
Stage Metrics (Simulation)
         │
         v
┌────────────────────────┐
│  Infer Node Type       │
│  (source, join, agg)   │
└───────────┬────────────┘
            │
            v
┌────────────────────────┐
│  Generate Columns      │
│  (mission-specific)    │
└───────────┬────────────┘
            │
            v
┌────────────────────────┐
│  Build Column Lineage  │
│  (track transforms)    │
└───────────┬────────────┘
            │
            v
┌────────────────────────┐
│  Lineage Graph         │
│  (React Flow UI)       │
└────────────────────────┘
```

## Configuration

### Environment Variables

All configuration is done through `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ENABLE_JAEGER` | `false` | Enable Jaeger exporter |
| `VITE_JAEGER_ENDPOINT` | `http://localhost:14268/api/traces` | Jaeger HTTP endpoint |
| `VITE_ENABLE_OTLP` | `true` | Enable OTLP exporter (Grafana/Tempo) |
| `VITE_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP HTTP endpoint |

### Custom Exporters

To add custom exporters, edit `src/lib/telemetry.ts`:

```typescript
// Add your custom exporter
import { CustomExporter } from 'your-package';

const customExporter = new CustomExporter({
  endpoint: 'https://your-backend.com/traces',
});

spanProcessors.push(new BatchSpanProcessor(customExporter));
```

## Column Lineage Details

### Supported Transformations

The lineage system tracks these common Spark operations:

1. **Source (Table Scan)**
   - Columns: Raw table columns
   - Transformation: `"table scan"`

2. **Join**
   - Columns: Combined from both sides
   - Transformation: `"join key"` or `"passthrough"`

3. **Aggregation**
   - Columns: GROUP BY keys + aggregated columns
   - Transformation: `"SUM(col)"`, `"COUNT(*)"`, `"AVG(col)"`, etc.

4. **Filter**
   - Columns: Passthrough from source
   - Transformation: `"filter predicate"`

5. **Project (Column Selection)**
   - Columns: Selected subset
   - Transformation: `"column selection"`

### Mission-Specific Schemas

Different missions have realistic schemas:

- **ETL Joins**: `customer_id`, `order_id`, `product_id`, `amount`, `timestamp`, `region`
- **CDC Merge**: `id`, `name`, `value`, `updated_at`, `_change_type`
- **Wide Schema**: `id`, `col_1`, ..., `col_50` (50 columns to demonstrate pruning)

### Extending Column Lineage

To add custom column transformations, edit `src/lib/lineage.ts`:

```typescript
function generateColumnLineage(
    stage: StageMetric,
    nodeType: LineageNodeType,
    missionId: MissionId
): { name: string; type: string }[] {
    // Add your custom logic here
    if (missionId === "my_custom_mission") {
        return [
            { name: "my_column", type: "string" },
            // ...
        ];
    }
    // ...
}
```

## Troubleshooting

### Traces not appearing in Jaeger/Grafana

1. **Check exporters are enabled**:
   ```bash
   cat .env | grep VITE_ENABLE
   # Should show VITE_ENABLE_OTLP=true
   ```

2. **Verify services are running**:
   ```bash
   docker-compose ps
   # All services should be "Up"
   ```

3. **Check browser console**:
   - Open DevTools → Console
   - Look for: `✅ OTLP exporter configured: http://localhost:4318/v1/traces`
   - If you see errors, check the endpoint URL

4. **Check Docker logs**:
   ```bash
   docker-compose logs tempo
   docker-compose logs jaeger
   ```

### Column lineage not showing

1. **Verify the mission has columns defined**:
   - Check `src/lib/lineage.ts` → `generateColumnLineage()`
   - Ensure your mission has a case in the switch statement

2. **Check lineage viewer**:
   - Click on a node in the lineage graph
   - Look for "Columns (N)" section
   - Click to expand

### Performance issues

1. **Reduce trace export frequency**:
   - Set `VITE_ENABLE_OTLP=false` for local development
   - Re-enable for testing

2. **Use Jaeger instead of Tempo**:
   - Jaeger is lighter weight
   - Set `VITE_ENABLE_JAEGER=true` and `VITE_ENABLE_OTLP=false`

## Advanced Usage

### TraceQL Queries (Grafana)

Example queries for Tempo in Grafana:

```traceql
# Find all traces for a specific mission
{ .missionId = "etl_joins" }

# Find slow operations (>1s)
{ duration > 1s }

# Find traces with errors
{ status = error }

# Find traces with specific knob enabled
{ .aqe = true }

# Combine conditions
{ .missionId = "etl_joins" && duration > 500ms }
```

### Span Attributes

All traces include these attributes:

- `missionId`: Current mission (e.g., `"etl_joins"`)
- `operation`: Type of operation (e.g., `"simulate"`, `"render"`)
- `knobs.*`: All knob settings (e.g., `knobs.aqe=true`)
- `snapshot.runtimeMin`: Current runtime
- `snapshot.costUSD`: Current cost

### Export Traces for Analysis

From Jaeger UI:
1. Search for traces
2. Click on a trace
3. Click "JSON" tab
4. Copy JSON for analysis

From Grafana:
1. Open trace in Explore
2. Click "Inspector" → "Data"
3. Download as JSON

## Production Considerations

For production deployments:

1. **Use managed services**:
   - Grafana Cloud (includes Tempo)
   - AWS X-Ray
   - Google Cloud Trace
   - DataDog APM

2. **Secure endpoints**:
   - Use HTTPS for OTLP endpoints
   - Add authentication headers

3. **Sampling**:
   - Implement head-based or tail-based sampling
   - Reduce trace volume for high-traffic apps

4. **Privacy**:
   - Avoid logging PII in span attributes
   - Implement data redaction

## Resources

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Grafana Tempo Docs](https://grafana.com/docs/tempo/)
- [TraceQL Guide](https://grafana.com/docs/tempo/latest/traceql/)
- [OpenTelemetry JavaScript SDK](https://opentelemetry.io/docs/instrumentation/js/)

## Support

For issues or questions:
1. Check this guide
2. Review browser console for errors
3. Check Docker logs: `docker-compose logs`
4. File an issue on GitHub
