using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STS.Migrations
{
    /// <inheritdoc />
    public partial class AddStsAllocationRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Note: LastLatitude/LastLongitude/LastLocationAt/LastSeenAt (Users) and MeetingMode
            // (SalesRecords) are intentionally NOT added here — they already exist in the
            // database from earlier GPS/meeting work that was never recorded in migration
            // history. Re-adding them here would fail with a duplicate-column error.

            migrationBuilder.CreateTable(
                name: "StsAllocationRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantCompanyId = table.Column<int>(type: "int", nullable: false),
                    SalesDataId = table.Column<int>(type: "int", nullable: false),
                    RequestedById = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReviewComment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReviewedById = table.Column<int>(type: "int", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StsAllocationRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StsAllocationRequests_SalesRecords_SalesDataId",
                        column: x => x.SalesDataId,
                        principalTable: "SalesRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StsAllocationRequests_Users_RequestedById",
                        column: x => x.RequestedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StsAllocationRequests_Users_ReviewedById",
                        column: x => x.ReviewedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StsAllocationRequests_RequestedById",
                table: "StsAllocationRequests",
                column: "RequestedById");

            migrationBuilder.CreateIndex(
                name: "IX_StsAllocationRequests_ReviewedById",
                table: "StsAllocationRequests",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_StsAllocationRequests_SalesDataId",
                table: "StsAllocationRequests",
                column: "SalesDataId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StsAllocationRequests");
        }
    }
}
