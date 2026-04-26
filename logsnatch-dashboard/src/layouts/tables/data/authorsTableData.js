/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDBadge from "components/MDBadge";

// Accepts an array of scan row objects returned from /api/scan-table.
// Each object has: scanID, scanDateTime, scanPass, scanUser, scanType,
//                  logLocation, warningCount
export default function data(scanRows = []) {
  const ScanResult = ({ passed }) => (
    <MDBadge
      badgeContent={passed ? "Pass" : "Fail"}
      color={passed ? "success" : "error"}
      variant="gradient"
      size="sm"
    />
  );

  const rows = scanRows.map((scan) => {
    const dt = scan.scanDateTime ? new Date(scan.scanDateTime) : null;
    const formattedDate = dt
      ? dt.toLocaleString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "N/A";

    // Derive a rough scan duration label — not stored in DB, so we show scan type instead
    const scanDurationLabel = scan.scanType || "—";

    return {
      "Scan Start Time": (
        <MDTypography variant="caption" color="text" fontWeight="medium">
          {formattedDate}
        </MDTypography>
      ),
      "Scan Duration": (
        <MDTypography variant="caption" color="text" fontWeight="medium">
          {scanDurationLabel}
        </MDTypography>
      ),
      "Scan Results": <ScanResult passed={Boolean(scan.scanPass)} />,
      Warnings: (
        <MDTypography variant="caption" color="text" fontWeight="medium">
          {scan.warningCount}
        </MDTypography>
      ),
      "Log Location": (
        <MDTypography
          component="span"
          variant="caption"
          color="text"
          fontWeight="medium"
          sx={{
            maxWidth: "200px",
            display: "inline-block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={scan.logLocation}
        >
          {scan.logLocation || "N/A"}
        </MDTypography>
      ),
    };
  });

  return {
    columns: [
      { Header: "Scan Start Time", accessor: "Scan Start Time", width: "25%", align: "left" },
      { Header: "Scan Duration", accessor: "Scan Duration", align: "left" },
      { Header: "Scan Results", accessor: "Scan Results", align: "center" },
      { Header: "Warnings", accessor: "Warnings", align: "center" },
      { Header: "Log Location", accessor: "Log Location", align: "center" },
    ],
    rows,
  };
}
