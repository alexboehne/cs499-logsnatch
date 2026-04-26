// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";

// Data
import authorsTableData from "layouts/tables/data/authorsTableData";
import projectsTableData from "layouts/tables/data/projectsTableData";

import { useState, useEffect } from "react";

function Tables() {
  const [scanRows, setScanRows] = useState([]);
  const [warningRows, setWarningRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const headers = { Authorization: "Bearer " + token };

    Promise.all([
      fetch("http://localhost:5000/api/scan-table", { headers }).then((r) => r.json()),
      fetch("http://localhost:5000/api/warnings-table", { headers }).then((r) => r.json()),
    ])
      .then(([scanData, warningData]) => {
        if (scanData.success) setScanRows(scanData.scans);
        else setError("Failed to load scan data.");

        if (warningData.success) setWarningRows(warningData.warnings);
        else setError((prev) => (prev ? prev + " Failed to load warnings." : "Failed to load warnings."));
      })
      .catch(() => setError("Could not reach the server."))
      .finally(() => setLoading(false));
  }, []);

  // Build column/row definitions from the (possibly empty) fetched data
  const { columns, rows } = authorsTableData(scanRows);
  const { columns: pColumns, rows: pRows } = projectsTableData(warningRows);

  const tableBody = loading ? (
    <MDBox display="flex" justifyContent="center" alignItems="center" py={6}>
      <CircularProgress color="info" />
    </MDBox>
  ) : null;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        {error && (
          <MDBox mb={2}>
            <MDTypography variant="caption" color="error">
              {error}
            </MDTypography>
          </MDBox>
        )}
        <Grid container spacing={6}>
          {/* Scan Table */}
          <Grid item xs={12}>
            <Card>
              <MDBox
                mx={2}
                mt={-3}
                py={3}
                px={2}
                variant="gradient"
                bgColor="info"
                borderRadius="lg"
                coloredShadow="info"
              >
                <MDTypography variant="h6" color="white">
                  Scan Table
                </MDTypography>
              </MDBox>
              <MDBox pt={3}>
                {tableBody || (
                  <DataTable
                    table={{ columns, rows }}
                    isSorted={false}
                    entriesPerPage={false}
                    showTotalEntries={false}
                    noEndBorder
                  />
                )}
              </MDBox>
            </Card>
          </Grid>

          {/* Warnings Table */}
          <Grid item xs={12}>
            <Card>
              <MDBox
                mx={2}
                mt={-3}
                py={3}
                px={2}
                variant="gradient"
                bgColor="info"
                borderRadius="lg"
                coloredShadow="info"
              >
                <MDTypography variant="h6" color="white">
                  Warnings Table — Rootkit Violations
                </MDTypography>
              </MDBox>
              <MDBox pt={3}>
                {tableBody || (
                  <DataTable
                    table={{ columns: pColumns, rows: pRows }}
                    isSorted={false}
                    entriesPerPage={false}
                    showTotalEntries={false}
                    noEndBorder
                  />
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
    </DashboardLayout>
  );
}

export default Tables;
