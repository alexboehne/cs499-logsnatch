// @mui material components
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import PieChart from "examples/Charts/PieChart";

import { useState, useEffect } from "react";

// Fallback shapes so the charts never receive undefined props while loading
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

function Dashboard() {
  const [barChartData, setBarChartData] = useState(EMPTY_BAR);
  const [pieChartData, setPieChartData] = useState(EMPTY_PIE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");

    fetch("http://localhost:5000/api/dashboard-charts", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBarChartData(data.barChart);
          setPieChartData(data.pieChart);
        } else {
          setError("Failed to load chart data.");
        }
      })
      .catch(() => setError("Could not reach the server."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        {error && (
          <MDBox mb={2}>
            <MDTypography variant="caption" color="error">
              {error}
            </MDTypography>
          </MDBox>
        )}
        {loading ? (
          <MDBox display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress color="info" />
          </MDBox>
        ) : (
          <Grid container spacing={3}>
            {/* Bar Chart */}
            <Grid item xs={12} md={6} lg={6}>
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

            {/* Pie Chart */}
            <Grid item xs={12} md={6} lg={6}>
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
      </MDBox>
    </DashboardLayout>
  );
}

export default Dashboard;
