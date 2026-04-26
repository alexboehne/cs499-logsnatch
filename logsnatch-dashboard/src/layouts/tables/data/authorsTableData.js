/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */

import MDTypography from "components/MDTypography";
import MDBadge from "components/MDBadge";

// Receives the array from /api/scan-table.
// Each object: { scanID, scanDateTime, scanPass, scanUser, scanType, logLocation, warningCount }
export default function data(scanRows = []) {

  const PassBadge = ({ passed }) => (
    <MDBadge
      badgeContent={passed ? "Pass" : "Fail"}
      color={passed ? "success" : "error"}
      variant="gradient"
      size="sm"
    />
  );

  const TruncatedText = ({ value, maxWidth = "180px" }) => (
    <MDTypography
      component="span"
      variant="caption"
      color="text"
      fontWeight="medium"
      title={value}
      sx={{
        maxWidth,
        display: "inline-block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {value || "N/A"}
    </MDTypography>
  );

  const Text = ({ value }) => (
    <MDTypography variant="caption" color="text" fontWeight="medium">
      {value ?? "—"}
    </MDTypography>
  );

  const rows = scanRows.map((scan) => {
    const dt = scan.scanDateTime ? new Date(scan.scanDateTime) : null;
    const formattedDate = dt
      ? dt.toLocaleString("en-US", {
          month: "short", day: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        })
      : "N/A";

    return {
      "Scan ID":       <Text value={scan.scanID} />,
      "Date / Time":   <Text value={formattedDate} />,
      "Scan Type":     <Text value={scan.scanType} />,
      "Result":        <PassBadge passed={Boolean(scan.scanPass)} />,
      "Warnings":      <Text value={scan.warningCount} />,
      "User":          <Text value={scan.scanUser} />,
      "Log Location":  <TruncatedText value={scan.logLocation} />,
    };
  });

  return {
    columns: [
      { Header: "Scan ID",      accessor: "Scan ID",      width: "6%",  align: "left"   },
      { Header: "Date / Time",  accessor: "Date / Time",  width: "22%", align: "left"   },
      { Header: "Scan Type",    accessor: "Scan Type",    width: "10%", align: "left"   },
      { Header: "Result",       accessor: "Result",       width: "8%",  align: "center" },
      { Header: "Warnings",     accessor: "Warnings",     width: "8%",  align: "center" },
      { Header: "User",         accessor: "User",         width: "10%", align: "left"   },
      { Header: "Log Location", accessor: "Log Location", align: "left"                 },
    ],
    rows,
  };
}
