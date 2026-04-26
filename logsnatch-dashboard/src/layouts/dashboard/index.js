import { useState, useEffect, useCallback } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import PieChart from "examples/Charts/PieChart";

const EMPTY_BAR = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: { label: "Scans Per Day", data: [0, 0, 0, 0, 0, 0, 0] },
};

const EMPTY_PIE = {
  labels: ["Rootkit", "SSH", "SUID", "EnvCheck"],
  datasets: {
    label: "Violations by Scan Type",
    backgroundColors: ["info", "primary", "dark", "warning"],
    data: [0, 0, 0, 0],
  },
};

const SCAN_TYPES = [
  { name: "rootkit", label: "Rootkit Scan", color: "error" },
  { name: "ssh",     label: "SSH Scan",     color: "warning" },
  { name: "suid",    label: "SUID Scan",    color: "info" },
  { name: "envcheck",label: "Env Check",    color: "success" },
];

function Dashboard() {
  const [barChartData, setBarChartData]   = useState(EMPTY_BAR);
  const [pieChartData, setPieChartData]   = useState(EMPTY_PIE);
  const [chartLoading, setChartLoading]   = useState(true);
  const [chartError, setChartError]       = useState(null);

  // Per-scan button state: { [scanName]: "idle" | "running" }
  const [scanStates, setScanStates] = useState(
    Object.fromEntries(SCAN_TYPES.map((s) => [s.name, "idle"]))
  );

  // Snackbar feedback
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const fetchCharts = useCallback(() => {
    const token = localStorage.getItem("authToken");
    setChartLoading(true);
    fetch("http://localhost:5000/api/dashboard-charts", {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setBarChartData(data.barChart);
          setPieChartData(data.pieChart);
          setChartError(null);
        } else {
          setChartError("Failed to load chart data.");
        }
      })
      .catch(() => setChartError("Could not reach the server."))
      .finally(() => setChartLoading(false));
  }, []);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  const handleScan = (scanName) => {
    const token  = localStorage.getItem("authToken");
    const userId = localStorage.getItem("authUid");

    if (!userId) {
      setSnackbar({ open: true, message: "User ID not found — please log out and log in again.", severity: "error" });
      return;
    }

    setScanStates((prev) => ({ ...prev, [scanName]: "running" }));

    fetch("http://localhost:5000/api/trigger-scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ userId: Number(userId), scanName }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSnackbar({ open: true, message: `${scanName.toUpperCase()} scan completed successfully.`, severity: "success" });
          fetchCharts(); // refresh charts after scan
        } else {
          setSnackbar({ open: true, message: `Scan failed: ${data.error || "Unknown error"}`, severity: "error" });
        }
      })
      .catch(() =>
        setSnackbar({ open: true, message: "Could not reach the server.", severity: "error" })
      )
      .finally(() => setScanStates((prev) => ({ ...prev, [scanName]: "idle" })));
  };

  const handleSnackbarClose = () => setSnackbar((prev) => ({ ...prev, open: false }));

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>

        {/* ── Charts ── */}
        {chartError && (
          <MDBox mb={2}>
            <MDTypography variant="caption" color="error">{chartError}</MDTypography>
          </MDBox>
        )}

        {chartLoading ? (
          <MDBox display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress color="info" />
          </MDBox>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <MDBox mb={3}>
                <ReportsBarChart
                  color="info"
                  title="Scans Per Day"
                  description="Number of scans run over the last 7 days"
                  date="updated on load"
                  chart={barChartData}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6}>
              <MDBox mb={3}>
                <PieChart
                  icon={{ component: "pie_chart", color: "info" }}
                  title="Violations by Scan Type"
                  description="Total violations found per scan category"
                  date="updated on load"
                  chart={pieChartData}
                />
              </MDBox>
            </Grid>
          </Grid>
        )}

        {/* ── Scan Buttons ── */}
        <Card>
          <MDBox p={3}>
            <MDTypography variant="h6" mb={2}>
              Run a Scan
            </MDTypography>
            <Grid container spacing={2}>
              {SCAN_TYPES.map((scan) => {
                const running = scanStates[scan.name] === "running";
                return (
                  <Grid item xs={12} sm={6} md={3} key={scan.name}>
                    <MDButton
                      variant="gradient"
                      color={scan.color}
                      fullWidth
                      disabled={running || Object.values(scanStates).includes("running")}
                      onClick={() => handleScan(scan.name)}
                    >
                      {running ? (
                        <MDBox display="flex" alignItems="center" gap={1}>
                          <CircularProgress size={16} color="inherit" />
                          &nbsp;Running…
                        </MDBox>
                      ) : (
                        scan.label
                      )}
                    </MDButton>
                  </Grid>
                );
              })}
            </Grid>
            <MDTypography variant="caption" color="text" mt={1} display="block">
              Scans may take up to 15 seconds to complete. All other buttons are disabled while a scan is running.
            </MDTypography>
          </MDBox>
        </Card>

      </MDBox>

      {/* ── Feedback Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}

export default Dashboard;
