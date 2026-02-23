/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)
Coded by www.creative-tim.com
 =========================================================
* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/
// @mui material components
import Grid from "@mui/material/Grid";
// Material Dashboard 2 React components
import MDBox from "components/MDBox";
// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
//import Footer from "examples/Footer"; // ADDED: Footer import was missing, causing 'Footer is not defined' error
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import PieChart from "examples/Charts/PieChart";
import ReportsLineChart from "examples/Charts/LineCharts/ReportsLineChart";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
// Data
import reportsBarChartData from "layouts/dashboard/data/reportsBarChartData";
import reportsLineChartData from "layouts/dashboard/data/reportsLineChartData";
// Dashboard components
import Projects from "layouts/dashboard/components/Projects";
import OrdersOverview from "layouts/dashboard/components/OrdersOverview";

// Fake data for the bar chart
const myBarChartData = {
  labels: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  datasets: {
    label: "Number of Alerts Per Day (Proof of Concept)",
    data: [50, 80, 40, 90, 60, 120, 100],
  },
};

// Fake data for the pie chart
const myPieChartData = {
  labels: ["Rootkits", "Modified Binaries", "Virus"],
  datasets: {
    label: "Types of Vulnerabilities (Proof of Concept)",
    backgroundColors: ["info", "primary", "dark"],
    data: [40, 35, 25],
  },
};

function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Grid container spacing={3}>
          {/* Bar Chart */}
          <Grid item xs={12} md={6} lg={6}>
            <MDBox mb={3}>
              <ReportsBarChart
                color="info"
                title="Number of Alerts Per Day"
                description="Data is not real. Proof of Concept"
                date="updated today"
                chart={myBarChartData}
              />
            </MDBox>
          </Grid>
          {/* Pie Chart */}
          <Grid item xs={12} md={6} lg={6}>
            <MDBox mb={3}>
              <PieChart
                icon={{ component: "pie_chart", color: "info" }}
                title="Types of Vulnerabilities Found"
                description="Data is not real. Proof of Concept"
                date="updated today"
                chart={myPieChartData}
              />
            </MDBox>
          </Grid>
        </Grid>
      </MDBox>
    </DashboardLayout>
  );
}

export default Dashboard;
