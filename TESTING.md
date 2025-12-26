# Testing OpenTelemetry and Column Lineage

This guide provides step-by-step testing instructions for the OpenTelemetry tracing and column-level lineage features.

## Prerequisites

- Docker and Docker Compose installed
- Node.js and npm installed
- Port availability: 3000 (React), 3001 (Grafana), 4318 (OTLP), 16686 (Jaeger)

## Step 1: Start the Observability Stack

Start all observability services using Docker Compose:

```bash
docker-compose up -d
```

Verify all services are running:

```bash
docker-compose ps
```

You should see:
- ✅ `spark-app-jaeger` (Up)
- ✅ `spark-app-tempo` (Up)
- ✅ `spark-app-grafana` (Up)
- ✅ `spark-app-prometheus` (Up)

Check logs if any service failed:

```bash
docker-compose logs -f [service-name]
```

## Step 2: Configure the React App

Ensure your `.env` file has the correct settings:

```env
VITE_ENABLE_OTLP=true
VITE_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

## Step 3: Start the React App

```bash
npm run dev
```

The app should start at http://localhost:5173

**Expected console output:**
```
✅ OTLP exporter configured: http://localhost:4318/v1/traces
```

If you see this message, traces will be exported to Tempo/Grafana.

## Step 4: Generate Traces

Interact with the React app to generate traces:

1. **Navigate to a mission**
   - Select "ETL Joins" mission from the picker
   - This creates a trace with span: `mission.select`

2. **Toggle knobs**
   - Enable "AQE" toggle
   - Enable "Broadcast Customers"
   - Each change creates a `simulate` span

3. **Open Observability Panel**
   - Click the "Observability" tab
   - View the in-app trace viewer
   - Expand spans to see attributes

4. **View Lineage Graph**
   - Click "Lineage Graph" tab
   - See stage-based data lineage
   - Click nodes to expand column details

## Step 5: Verify Traces in Jaeger

1. Open Jaeger UI: http://localhost:16686

2. **Find Traces:**
   - Service: Select `spark-performance-react-app`
   - Click "Find Traces"

3. **Expected Traces:**
   - You should see multiple traces with operation names:
     - `mission.select`
     - `simulate`
     - `render.workspace`

4. **Inspect a Trace:**
   - Click on any trace
   - View the waterfall diagram
   - Check span attributes:
     - `missionId`: e.g., "etl_joins"
     - `knobs.aqe`: true/false
     - `snapshot.runtimeMin`: number
     - `snapshot.costUSD`: number

5. **Verify Timeline:**
   - Spans should show parent-child relationships
   - Nested spans should appear indented
   - Duration should be realistic (milliseconds)

## Step 6: Verify Traces in Grafana + Tempo

1. Open Grafana: http://localhost:3001

2. **Navigate to Explore:**
   - Click the compass icon (Explore)
   - Select **Tempo** as the datasource

3. **Search for Traces:**

   **Option A: Search by Service**
   - Click "Search" tab
   - Service Name: `spark-performance-react-app`
   - Click "Run query"

   **Option B: Use TraceQL**
   - Click "TraceQL" tab
   - Enter query:
     ```traceql
     { .missionId = "etl_joins" }
     ```
   - Click "Run query"

4. **Inspect Trace:**
   - Click on a trace to open details
   - View span tree with timing
   - Check span attributes in right panel
   - Verify metrics links (if Prometheus is configured)

5. **Advanced TraceQL Queries:**

   Find slow operations:
   ```traceql
   { duration > 100ms }
   ```

   Find specific knob combinations:
   ```traceql
   { .knobs.aqe = true && .knobs.broadcastCustomers = true }
   ```

   Find traces with errors:
   ```traceql
   { status = error }
   ```

## Step 7: Verify Column-Level Lineage

### In-App Lineage Viewer

1. Open the React app
2. Navigate to the **Observability Panel**
3. Click the **Lineage Graph** tab

**What to verify:**

- **Nodes show stage operations:**
  - Source (green): Table scans
  - Join (amber): Join operations
  - Aggregate (purple): Aggregations
  - Sink (red): Write operations

- **Edges show data flow:**
  - Gray lines: Normal data flow
  - Orange animated lines: Shuffle operations
  - Teal lines: Broadcast joins

- **Column details on nodes:**
  - Click any node
  - Look for "Columns (N)" section
  - Click to expand
  - Verify columns have:
    - ✅ Column name (e.g., `customer_id`)
    - ✅ Data type (e.g., `bigint`)
    - ✅ Source info (where it came from)
    - ✅ Transformation (e.g., `SUM(amount)`)

### Column Lineage for Different Missions

Test each mission to verify mission-specific schemas:

**ETL Joins Mission:**
```
Source: customer_id, order_id, product_id, amount, timestamp, region
Join: customer_id, order_id, product_name, amount, region
```

**CDC Merge Mission:**
```
Source: id, name, value, updated_at, _change_type
Filter: Same columns (deduplication)
```

**Wide Schema Mission:**
```
Source: id, col_1, col_2, ..., col_50 (50 columns)
Project: id, col_1, col_2, col_3 (pruned to 4 columns)
```

### Verify Transformations

For aggregate stages, verify transformations:
- `SUM(amount)` → Creates `total_amount` column
- `COUNT(*)` → Creates `count` column
- `AVG(amount)` → Creates `avg_amount` column

## Step 8: Export and Analyze Traces

### Export from Jaeger

1. Open a trace in Jaeger
2. Click "JSON" tab
3. Copy the JSON
4. Use for custom analysis or debugging

### Export from Grafana

1. Open a trace in Grafana Explore
2. Click "Inspector" button
3. Navigate to "Data" tab
4. Click "Download"
5. Save as JSON

## Common Issues and Solutions

### Issue: Traces not appearing in Jaeger/Grafana

**Solution 1:** Check OTLP endpoint
```bash
# Verify Tempo is listening on OTLP port
docker-compose logs tempo | grep "otlp"
# Should show: "OTLP HTTP receiver started on 0.0.0.0:4318"
```

**Solution 2:** Check browser console
- Open DevTools → Console
- Look for OTLP exporter message
- If missing, check `.env` file

**Solution 3:** Test OTLP endpoint manually
```bash
curl -v http://localhost:4318/v1/traces
# Should return 405 Method Not Allowed (expects POST)
```

### Issue: Column lineage not showing

**Solution:**
- Click on a node in the lineage graph
- Look for the "Columns" section at the bottom
- If missing, check that the mission has column definitions in `src/lib/lineage.ts`

### Issue: Docker services won't start

**Solution 1:** Check port conflicts
```bash
# Check if ports are already in use
lsof -i :16686  # Jaeger UI
lsof -i :3001   # Grafana
lsof -i :4318   # OTLP HTTP
```

**Solution 2:** Restart Docker
```bash
docker-compose down
docker-compose up -d
```

**Solution 3:** Check Docker logs
```bash
docker-compose logs -f
```

### Issue: Build errors

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Performance Testing

### Generate Load

Create multiple traces by:
1. Switching between missions rapidly
2. Toggling multiple knobs
3. Using the learning panel to complete steps

### Monitor Trace Volume

**In Jaeger:**
- Check trace count in the search results
- Should see traces accumulating

**In Grafana:**
- Run search without filters
- View trace count in results

### Check Memory Usage

Monitor in-memory exporter:
```javascript
// In browser console
import { spanExporter } from '@/lib/telemetry';
console.log(spanExporter.getSpans().length);
```

Clear if needed:
```javascript
import { clearTraces } from '@/lib/telemetry';
clearTraces();
```

## Cleanup

Stop all services:

```bash
docker-compose down
```

Remove volumes (clears all trace data):

```bash
docker-compose down -v
```

## Success Criteria

✅ **OpenTelemetry Setup:**
- [ ] Docker services all running
- [ ] React app exports traces to OTLP endpoint
- [ ] Console shows "✅ OTLP exporter configured" message
- [ ] Traces visible in Jaeger UI
- [ ] Traces visible in Grafana/Tempo
- [ ] TraceQL queries return results

✅ **Column Lineage:**
- [ ] Lineage graph displays in React app
- [ ] Nodes show correct operation types (colors)
- [ ] Edges show data flow (shuffle, broadcast)
- [ ] Clicking nodes reveals column details
- [ ] Columns show name, type, source, transformation
- [ ] Different missions have different schemas

✅ **Integration:**
- [ ] In-app trace viewer works
- [ ] Jaeger shows rich span attributes
- [ ] Grafana links traces to metrics (if Prometheus configured)
- [ ] TraceQL queries filter by mission and knobs

## Next Steps

Once testing is complete:

1. **Customize exporters** for your environment
2. **Add more column transformations** for your use cases
3. **Implement sampling** for production
4. **Create Grafana dashboards** for visualization
5. **Set up alerts** based on trace metrics

For more information, see [OBSERVABILITY.md](./OBSERVABILITY.md).
