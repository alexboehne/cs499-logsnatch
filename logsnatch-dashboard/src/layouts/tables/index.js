import { useState, useEffect } from "react";

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

import scanResultsTableData  from "layouts/tables/data/authorsTableData";
import warningsTableData     from "layouts/tables/data/projectsTableData";

function Tables() {
  const [scanRows,    setScanRows]    = useState([]);
  const [warningRows, setWarningRows] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    const token   = localStorage.getItem("authToken");
    const headers = { Authorization: "Bearer " + token };

    Promise.all([
      fetch("http://localhost:5000/api/scan-table",    { headers }).then((r) => r.json()),
      fetch("http://localhost:5000/api/warnings-table", { headers }).then((r) => r.json()),
    ])
      .then(([scanData, warningData]) => {
        if (scanData.success)    setScanRows(scanData.scans);
        if (warningData.success) setWarningRows(warningData.warnings);
        if (!scanData.success || !warningData.success)
          setError("Some data failed to load.");
      })
      .catch(() => setError("Could not reach the server."))
      .finally(() => setLoading(false));
  }, []);

  const { columns: scanCols, rows: scanTableRows }       = scanResultsTableData(scanRows);
  const { columns: warnCols, rows: warnTableRows }       = warningsTableData(warningRows);

  const Spinner = () => (
    <MDBox display="flex" justifyContent="center" alignItems="center" py={6}>
      <CircularProgress color="info" />
    </MDBox>
  );

  const TableCard = ({ title, bgColor, columns, rows }) => (
    <Grid item xs={12}>
      <Card>
        <MDBox
          mx={2} mt={-3} py={3} px={2}
          variant="gradient"
          bgColor={bgColor || "info"}
          borderRadius="lg"
          coloredShadow={bgColor || "info"}
        >
          <MDTypography variant="h6" color="white">{title}</MDTypography>
        </MDBox>
        <MDBox pt={3}>
          {loading ? <Spinner /> : (
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
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        {error && (
          <MDBox mb={2}>
            <MDTypography variant="caption" color="error">{error}</MDTypography>
          </MDBox>
        )}
        <Grid container spacing={6}>

          {/* scan_results — one row per scan */}
          <TableCard
            title="Scan Results"
            bgColor="info"
            columns={scanCols}
            rows={scanTableRows}
          />

          {/* All violations across all scan types */}
          <TableCard
            title="All Violations"
            bgColor="error"
            columns={warnCols}
            rows={warnTableRows}
          />

        </Grid>
      </MDBox>
    </DashboardLayout>
  );
}

export default Tables;
